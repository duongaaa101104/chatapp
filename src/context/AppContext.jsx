import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { createContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../config/firebase";
import { toast } from "react-toastify";

export const AppContext = createContext();

const AppContextProvider = (props) => {

    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [chatData, setChatData] = useState(null);
    const [messagesId, setMessagesId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [chatUser, setChatUser] = useState(null);
    const [chatVisible, setChatVisible] = useState(false);
    const [rightSidebarVisible, setRightSidebarVisible] = useState(false);
    const [appFullImage, setAppFullImage] = useState(null);

    const lastMsgTime = useRef(0); 

    const loadUserData = async (uid) => {
        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();
            setUserData(userData);
            
            if (userData.avatar && userData.name) {
                navigate('/chat');
            } else {
                navigate('/profile');
            }
            
            await updateDoc(userRef, { lastSeen: Date.now() });
            
            setInterval(async () => {
                if (auth.currentUser) {
                    await updateDoc(userRef, { lastSeen: Date.now() })
                }
            }, 60000);
        } catch (error) { console.log(error); }
    }

    // --- 1. XIN QUYỀN THÔNG BÁO KHI VÀO APP ---
    useEffect(() => {
        if ("Notification" in window) {
            if (Notification.permission !== "granted") {
                Notification.requestPermission();
            }
        }
    }, []);

    useEffect(() => {
        if (userData) {
            const chatRef = doc(db, 'chats', userData.id);

            const unSub = onSnapshot(chatRef, async (res) => {
                if (!res.exists()) {
                    setChatData([]);
                    return;
                }

                const chatItems = res.data().chatsData;
                if (!chatItems || chatItems.length === 0) {
                    setChatData([]);
                    return;
                }

                const tempData = [];
                for (const item of chatItems) {
                    const userRef = doc(db, 'users', item.rId);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        const userInfo = userSnap.data();
                        tempData.push({ ...item, userData: userInfo })
                    }
                }

                const sortedData = tempData.sort((a, b) => b.updatedAt - a.updatedAt);
                
                // --- LOGIC THÔNG BÁO NÂNG CAO ---
                const newestItem = sortedData[0];

                if (newestItem && newestItem.updatedAt > lastMsgTime.current) {
                    if (!newestItem.messageSeen && lastMsgTime.current !== 0) {
                        
                        // 1. Phát âm thanh
                        try {
                            const audio = new Audio('/nhay_nhay_di_may_tang_tang_tang-www_tiengdong_com.mp3');
                            audio.play().catch((e) => console.log("Audio blocked:", e));
                        } catch (error) { console.error(error); }

                        // 2. Hiện Toast (như cũ)
                        toast.info(`Tin nhắn mới từ ${newestItem.userData.name}`);

                        // 3. Gửi System Notification (Hiện kể cả khi ở tab khác)
                        if (document.hidden && Notification.permission === "granted") {
                            new Notification("Tin nhắn mới", {
                                body: `Bạn có tin nhắn từ ${newestItem.userData.name}`,
                                icon: '/logo_icon.png', // Thay bằng icon app của bạn nếu muốn
                                silent: true // Tắt tiếng của hệ thống để dùng tiếng của web (hoặc xóa dòng này để dùng tiếng mặc định)
                            });
                        }
                    }
                    lastMsgTime.current = newestItem.updatedAt;
                }
                // ------------------------------------

                setChatData(sortedData);
            })

            return () => {
                unSub();
            }
        }
    }, [userData])

    const value = {
        userData, setChatData,
        chatData, setUserData,
        loadUserData,
        messages, setMessages,
        messagesId, setMessagesId,
        chatUser, setChatUser,
        chatVisible, setChatVisible,
        rightSidebarVisible, setRightSidebarVisible,
        appFullImage, setAppFullImage
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )
}

export default AppContextProvider;