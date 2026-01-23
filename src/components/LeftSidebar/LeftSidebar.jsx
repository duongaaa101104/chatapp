import React, { useContext, useEffect, useState } from 'react'
import './LeftSidebar.css'
import assets from '../../assets/assets'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { AppContext } from '../../context/AppContext'
import { db, logout } from '../../config/firebase'
import { toast } from 'react-toastify'

const LeftSidebar = () => {

    const navigate = useNavigate();
    const { userData, chatData, chatUser, setChatUser, messagesId, setMessagesId, chatVisible, setChatVisible } = useContext(AppContext);
    const [allUsers, setAllUsers] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeMenu, setActiveMenu] = useState(null);

    // Load danh sách user để tìm kiếm
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
    }, [userData]);

    // Đóng menu khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.menu-chat-btn') && !event.target.closest('.chat-menu-dropdown')) {
                setActiveMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectUser = async (targetUser) => {
        // Kiểm tra xem đã có đoạn chat trong danh sách hiện tại chưa
        const existingChat = chatData ? chatData.find(c => c.rId === targetUser.id) : null;
        if (existingChat) {
            await openChat(existingChat);
        } else {
            await createNewChat(targetUser);
        }
        setSearchQuery("");
        setShowSearch(false);
    }

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
                    if (chatIndex !== -1) {
                        userChatData.chatsData[chatIndex].messageSeen = true;
                        await updateDoc(userChatsRef, {
                            chatsData: userChatData.chatsData
                        });
                    }
                }
            } catch (error) { console.error(error) }
        }
    }

    // --- LOGIC TẠO CHAT MỚI (ĐÃ SỬA LỖI TẠO TRÙNG) ---
    const createNewChat = async (targetUser) => {
        try {
            const messageRef = collection(db, "messages");
            const chatsRef = collection(db, "chats");

            // Kiểm tra phía người kia
            const userChatsRef = doc(chatsRef, targetUser.id);
            const userChatsSnapshot = await getDoc(userChatsRef);
            const userChatsData = userChatsSnapshot.data();
            const existingChat = userChatsData?.chatsData?.find(chat => chat.rId === userData.id);

            let newMessageId = "";

            if (existingChat) {
                newMessageId = existingChat.messageId;
            } else {
                const newMessageRef = doc(messageRef);
                newMessageId = newMessageRef.id;
                await setDoc(newMessageRef, {
                    createdAt: serverTimestamp(),
                    messages: []
                })
                
                // Thêm vào danh sách người kia (Người kia không cần resetTimestamp vì họ không xóa)
                await updateDoc(doc(chatsRef, targetUser.id), {
                    chatsData: arrayUnion({
                        messageId: newMessageId,
                        lastMessage: "",
                        rId: userData.id,
                        updatedAt: Date.now(),
                        messageSeen: true
                    })
                })
            }

            // --- QUAN TRỌNG: THÊM resetTimestamp CHO MÌNH ---
            const chatDataCommon = {
                messageId: newMessageId,
                lastMessage: existingChat ? (existingChat.lastMessage || "") : "",
                updatedAt: Date.now(),
                messageSeen: true,
                rId: targetUser.id,
                // Đánh dấu mốc thời gian bắt đầu hiển thị tin nhắn (là NOW)
                resetTimestamp: Date.now() 
            }

            await updateDoc(doc(chatsRef, userData.id), {
                chatsData: arrayUnion(chatDataCommon)
            })

            const uSnap = await getDoc(doc(db, "users", targetUser.id));
            openChat({
                ...chatDataCommon,
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

    // --- CHỨC NĂNG GHIM CHAT ---
    const pinChat = async (targetChat) => {
        try {
            const userChatsRef = doc(db, 'chats', userData.id);
            const userChatsSnapshot = await getDoc(userChatsRef);

            if (userChatsSnapshot.exists()) {
                const userChatsData = userChatsSnapshot.data();
                const chatIndex = userChatsData.chatsData.findIndex((c) => c.messageId === targetChat.messageId);

                if (chatIndex !== -1) {
                    const currentStatus = userChatsData.chatsData[chatIndex].isPinned || false;
                    userChatsData.chatsData[chatIndex].isPinned = !currentStatus;

                    await updateDoc(userChatsRef, { chatsData: userChatsData.chatsData });
                    toast.success(currentStatus ? "Đã bỏ ghim" : "Đã ghim đoạn chat");
                }
            }
            setActiveMenu(null);
        } catch (error) { toast.error("Lỗi: " + error.message); }
    }

    // --- CHỨC NĂNG XÓA CHAT ---
    const deleteChat = async (targetChat) => {
        if (!window.confirm(`Bạn có chắc muốn xóa đoạn chat với ${targetChat.userData.name}?`)) {
            setActiveMenu(null); return;
        }
        try {
            const userChatsRef = doc(db, 'chats', userData.id);
            const userChatsSnapshot = await getDoc(userChatsRef);
            if (userChatsSnapshot.exists()) {
                const userChatsData = userChatsSnapshot.data();
                // Lọc bỏ chat cần xóa
                const updatedChats = userChatsData.chatsData.filter(c => c.messageId !== targetChat.messageId);
                await updateDoc(userChatsRef, { chatsData: updatedChats });
                
                // Nếu đang mở chat đó thì đóng lại
                if (chatUser && chatUser.messageId === targetChat.messageId) {
                    setChatUser(null);
                    setMessagesId(null);
                }
                toast.success("Đã xóa đoạn chat");
            }
        } catch (error) { toast.error("Lỗi: " + error.message); }
        setActiveMenu(null);
    }

    // --- SẮP XẾP DANH SÁCH (GHIM LÊN ĐẦU) ---
    const sortedChatData = chatData ? [...chatData].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0; 
    }) : [];

    return (
        <div className={`ls ${chatVisible ? "hidden" : ""}`}>
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
                        filteredUsers.length > 0 ? filteredUsers.map((item, index) => (
                            <div onClick={() => handleSelectUser(item)} key={index} className='friends add-user'>
                                <img src={item.avatar} alt='' />
                                <p>{item.name}</p>
                            </div>
                        )) : <p className='no-result'>Không có kết quả</p>
                    )
                    : (
                        sortedChatData.map((item, index) => (
                            <div
                                onClick={() => openChat(item)}
                                key={index}
                                className={`friends ${item.messageSeen || item.messageId === messagesId ? "" : "border"} ${activeMenu === item.messageId ? "menu-active" : ""}`}
                            >
                                <img src={item.userData.avatar} alt="" />
                                <div>
                                    <p>{item.userData.name}</p>
                                    <span className={item.messageSeen || item.messageId === messagesId ? "" : "not-seen"}>
                                        {item.lastMessage || "Bắt đầu trò chuyện"}
                                    </span>
                                </div>

                                {/* Icon Ghim */}
                                {item.isPinned && (
                                    <img src="https://cdn-icons-png.flaticon.com/512/2951/2951513.png" className="pinned-icon" alt="Pinned" />
                                )}

                                {/* MENU 3 CHẤM */}
                                <div
                                    className="menu-chat-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenu(activeMenu === item.messageId ? null : item.messageId);
                                    }}
                                >
                                    <img src={assets.menu_icon} alt="More" />
                                </div>

                                {/* DROPDOWN */}
                                {activeMenu === item.messageId && (
                                    <div className="chat-menu-dropdown">
                                        <div className="menu-item" onClick={(e) => { e.stopPropagation(); pinChat(item); }}>
                                            <img src="https://cdn-icons-png.flaticon.com/512/2951/2951513.png" width="14" alt="" />
                                            {item.isPinned ? "Bỏ ghim" : "Ghim hội thoại"}
                                        </div>
                                        <div className="menu-item delete" onClick={(e) => { e.stopPropagation(); deleteChat(item); }}>
                                            <img src="https://cdn-icons-png.flaticon.com/512/1214/1214428.png" width="14" alt="" />
                                            Xóa đoạn chat
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
            </div>
        </div>
    )
}

export default LeftSidebar