import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// 1. IMPORT THÊM auth VÀ db
import { auth, db } from "../config/firebase";

export const AppContext = createContext();

const AppContextProvider = (props) => {

    // 2. Sửa lỗi chính tả: naviagate -> navigate
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [chatData, setChatData] = useState(null);
    const [messagesId, setMessagesId] = useState(null);
    const [messages, setMessages] = useState([[]]);
    const [chatUser, setChatUser] = useState(null);
    const [chatVisible,setChatVisible] =useState(false);
    const [rightSidebarVisible, setRightSidebarVisible] = useState(false);

    const loadUserData = async (uid) => {
        try {
            // 3. Sửa lỗi: scrollBy -> db | 'user' -> 'users' (số nhiều cho thống nhất)
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();

            setUserData(userData);

            // Logic chuyển trang
            if (userData.avatar && userData.name) {
                navigate('/chat');
            } else {
                navigate('/profile');
            }

            await updateDoc(userRef, {
                lastSeen: Date.now()
            })

            setInterval(async () => {
                // 4. Sửa lỗi: auth.chatUser -> auth.currentUser
                if (auth.currentUser) {
                    await updateDoc(userRef, {
                        lastSeen: Date.now()
                    })
                }
            }, 60000);

        } catch (error) {
            console.log(error);
        }
    }

    useEffect(() => {
        if (userData) {
            const chatRef = doc(db, 'chats', userData.id);

            const unSub = onSnapshot(chatRef, async (res) => {
                // Kiểm tra xem document có tồn tại không
                if (!res.exists()) {
                    setChatData([]);
                    return;
                }

                const chatItems = res.data().chatsData;

                // --- SỬA THÊM: Kiểm tra an toàn ---
                // Nếu chưa có tin nhắn nào (chatItems là null hoặc mảng rỗng)
                if (!chatItems || chatItems.length === 0) {
                    setChatData([]); // Set mảng rỗng để không bị lỗi map bên giao diện
                    return;
                }
                // ----------------------------------

                const tempData = [];
                for (const item of chatItems) {
                    const userRef = doc(db, 'users', item.rId);
                    const userSnap = await getDoc(userRef);

                    // Kiểm tra user kia có tồn tại không (tránh lỗi khi user kia bị xóa)
                    if (userSnap.exists()) {
                        const userInfo = userSnap.data();
                        tempData.push({ ...item, userData: userInfo })
                    }
                }

                setChatData(tempData.sort((a, b) => b.updatedAt - a.updatedAt))
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
        messages,setMessages,
        messagesId,setMessagesId,
        chatUser,setChatUser,
        chatVisible,setChatVisible,
        rightSidebarVisible,setRightSidebarVisible
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )
}

export default AppContextProvider;