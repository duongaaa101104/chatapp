import React, { useContext, useEffect, useState } from 'react'
import './LeftSidebar.css'
import assets from '../../assets/assets'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { AppContext } from '../../context/AppContext'
import { db, logout } from '../../config/firebase'
import { toast } from 'react-toastify'

const LeftSidebar = () => {

    const navigate = useNavigate();

    const { userData, chatData, chatUser, setChatUser, messagesId, setMessagesId ,chatVisible,setChatVisible  } = useContext(AppContext);
    const [allUsers, setAllUsers] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const loadAllUsers = async () => {
            try {
                const userRef = collection(db, 'users');
                const snap = await getDocs(userRef);
                const list = [];
                snap.forEach((doc) => {
                    if (doc.data().id !== userData.id) {
                        list.push(doc.data());
                    }
                })
                setAllUsers(list);
            } catch (error) { console.error(error); }
        }
        if (userData) { loadAllUsers(); }
    }, [userData])

    // Xử lý khi chọn một người
    const handleSelectUser = async (targetUser) => {
        const existingChat = chatData ? chatData.find(c => c.rId === targetUser.id) : null;
        if (existingChat) {
            await openChat(existingChat);
        } else {
            await createNewChat(targetUser);
        }
        setSearchQuery(""); 
        setShowSearch(false);
    }
    //
    const openChat = async (item) => {
        setChatUser(item);

        setMessagesId(item.messageId);
setChatVisible(true);
        if (!item.messageSeen) {
            try {
                const userChatsRef = doc(db, 'chats', userData.id);
                const userChatsSnapshot = await getDoc(userChatsRef);
                if (userChatsSnapshot.exists()) {
                    const userChatData = userChatsSnapshot.data();
                    const chatIndex = userChatData.chatsData.findIndex((c) => c.messageId === item.messageId);
                    
                    if(chatIndex !== -1){
                        userChatData.chatsData[chatIndex].messageSeen = true;
                        await updateDoc(userChatsRef, {
                            chatsData: userChatData.chatsData
                        });
                    }
                }
            } catch (error) { console.error(error) }
        }
    }

    const createNewChat = async (targetUser) => {
        try {
            const messageRef = collection(db, "messages");
            const chatsRef = collection(db, "chats");
            const newMessageRef = doc(messageRef);

            await setDoc(newMessageRef, {
                createdAt: serverTimestamp(),
                messages: []
            })

            const chatDataCommon = {
                messageId: newMessageRef.id,
                lastMessage: "",
                updatedAt: Date.now(),
                messageSeen: true
            }

            await updateDoc(doc(chatsRef, targetUser.id), {
                chatsData: arrayUnion({ ...chatDataCommon, rId: userData.id })
            })

            await updateDoc(doc(chatsRef, userData.id), {
                chatsData: arrayUnion({ ...chatDataCommon, rId: targetUser.id })
            })
            
            const uSnap = await getDoc(doc(db, "users", targetUser.id));
            openChat({ 
                ...chatDataCommon, 
                rId: targetUser.id, 
                userData: uSnap.data() 
            })
            
        } catch (error) {
            toast.error(error.message);
        }
    }

    const inputHandler = (e) => {
        const input = e.target.value;
        setSearchQuery(input.toLowerCase());
        setShowSearch(input.length > 0);
    }

    const filteredUsers = allUsers.filter(u => u.username.toLowerCase().includes(searchQuery) || u.name.toLowerCase().includes(searchQuery));

    return (
        <div className={`ls ${chatVisible? "hidden" :""}`}>
            <div className="ls-top">
                <div className="ls-nav">
                    <img className="logo" src={assets.logo} alt="logo" />
                    <div className="menu">
                        <img src={assets.menu_icon} alt="" />
                        <div className="sub-menu">
                            <p onClick={() => navigate('/profile')}>Hồ sơ</p>
                            <hr />
                            <p onClick={() => logout()}>Đăng xuất</p>
                        </div>
                    </div>
                </div>
                <div className="ls-search">
                    <img src={assets.search_icon} alt="" />
                    <input onChange={inputHandler} value={searchQuery} type="text" placeholder='Tìm kiếm bạn bè...' />
                </div>
            </div>
            
            <div className="ls-list">
                {showSearch 
                ? (
                    // --- GIAO DIỆN TÌM KIẾM ---
                    filteredUsers.length > 0 ? filteredUsers.map((item, index) => (
                        <div onClick={() => handleSelectUser(item)} key={index} className='friends add-user'>
                            <img src={item.avatar} alt='' />
                            <p>{item.name}</p>
                        </div>
                    )) : <p className='no-result'>Không có tên</p>
                ) 
                : (
                    // --- GIAO DIỆN DANH SÁCH CHAT ---
                    // 3. Map qua chatData để lấy được tin nhắn cuối và trạng thái seen
                    chatData && chatData.map((item, index) => (
                        <div 
                            onClick={() => openChat(item)} 
                            key={index} 
                            // 4. Kiểm tra messagesId ở đây
                            className={`friends ${item.messageSeen || item.messageId === messagesId ? "" : "border"}`}
                        >
                            <img src={item.userData.avatar} alt="" />
                            <div>
                                <p>{item.userData.name}</p>
                                <span className={item.messageSeen || item.messageId === messagesId ? "" : "not-seen"}>
                                    {item.lastMessage || "Bắt đầu trò chuyện"}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default LeftSidebar