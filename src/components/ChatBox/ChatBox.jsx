import React, { useContext, useEffect, useState, useRef } from 'react'
import './ChatBox.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext'
import { onSnapshot, arrayUnion, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { toast } from 'react-toastify'
import upload from '../../lib/upload'
import EmojiPicker from 'emoji-picker-react' // 1. IMPORT THƯ VIỆN

const ChatBox = () => {

    const { userData, setMessages, chatUser, messages, messagesId, chatVisible, setChatVisible, setRightSidebarVisible, chatData, setChatUser, setMessagesId } = useContext(AppContext)
    const [input, setInput] = useState("")
    const [userProfile, setUserProfile] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [openEmoji, setOpenEmoji] = useState(false); // 2. STATE BẬT TẮT EMOJI

    const typingTimeoutRef = useRef(null);


    const [msgInfo, setMsgInfo] = useState(null); // Lưu object tin nhắn đang xem



    // Lắng nghe Online
    useEffect(() => {
        if (chatUser) {
            setUserProfile(chatUser.userData);
            const unSub = onSnapshot(doc(db, "users", chatUser.userData.id), (docSnapshot) => {
                if (docSnapshot.exists()) {
                    setUserProfile(docSnapshot.data());
                }
            });
            return () => unSub();
        }
    }, [chatUser])


    // --- HÀM FORMAT NGÀY GIỜ CHI TIẾT ---
    const formatFullTime = (timestamp) => {
        if (!timestamp) return "N/A";
        let date;
        if (timestamp.toDate) date = timestamp.toDate();
        else date = new Date(timestamp);
        
        // Định dạng: 14:30 - Ngày 20/05/2024
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')} - Ngày ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    }


    // --- XỬ LÝ EMOJI ---
    const handleEmoji = (e) => {
        // e.emoji chứa ký tự icon (vd: 😀)
        setInput((prev) => prev + e.emoji); 
    }
    // -------------------

    const deleteMessage = async (msgId) => {
        try {
            if (!msgId) return;
            if(!window.confirm("Bạn có chắc muốn thu hồi tin nhắn này?")) return;

            const msgRef = doc(db, 'messages', messagesId);
            const snap = await getDoc(msgRef);
            
            if (snap.exists()) {
                const data = snap.data();
                const allMessages = data.messages;
                const isLastMessage = allMessages.length > 0 && allMessages[allMessages.length - 1].msgId === msgId;

                const updatedMessages = allMessages.map((msg) => {
                    if (msg.msgId === msgId) {
                        return { ...msg, isDeleted: true, text: "Tin nhắn đã bị thu hồi", image: "" }
                    }
                    return msg;
                });

                await updateDoc(msgRef, { messages: updatedMessages });

                if (isLastMessage) {
                    const userIDs = [chatUser.rId, userData.id];
                    userIDs.forEach(async (id) => {
                        const userChatsRef = doc(db, 'chats', id);
                        const userChatsSnapshot = await getDoc(userChatsRef);
                        if (userChatsSnapshot.exists()) {
                            const userChatData = userChatsSnapshot.data();
                            const chatIndex = userChatData.chatsData.findIndex((c) => c.messageId === messagesId);
                            if (chatIndex !== -1) {
                                userChatData.chatsData[chatIndex].lastMessage = "Tin nhắn đã bị thu hồi";
                                await updateDoc(userChatsRef, { chatsData: userChatData.chatsData });
                            }
                        }
                    });
                }
            }
        } catch (error) { toast.error("Lỗi: " + error.message); }
    }

    const handleSwitchChat = async (item) => {
        setChatUser(item);
        setMessagesId(item.messageId);
        setIsTyping(false);
        setOpenEmoji(false); // Đóng emoji khi chuyển chat
        if (!item.messageSeen) {
            try {
                const userChatsRef = doc(db, 'chats', userData.id);
                const userChatsSnapshot = await getDoc(userChatsRef);
                if (userChatsSnapshot.exists()) {
                    const userChatData = userChatsSnapshot.data();
                    const chatIndex = userChatData.chatsData.findIndex((c) => c.messageId === item.messageId);
                    if(chatIndex !== -1){
                        userChatData.chatsData[chatIndex].messageSeen = true;
                        await updateDoc(userChatsRef, { chatsData: userChatData.chatsData });
                    }
                }
            } catch (error) { console.error(error) }
        }
    }

    const handleInputChange = async (e) => {
        setInput(e.target.value);
        if (!messagesId) return;
        if (!typingTimeoutRef.current) {
             try { await updateDoc(doc(db, 'messages', messagesId), { [`typing.${userData.id}`]: true }); } 
             catch (error) { console.error(error) }
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(async () => {
            try { await updateDoc(doc(db, 'messages', messagesId), { [`typing.${userData.id}`]: false }); } 
            catch (error) { console.error(error) }
            typingTimeoutRef.current = null;
        }, 2000);
    }

    const sendMessage = async () => {
        try {
            if (input && messagesId) {
                await updateDoc(doc(db, 'messages', messagesId), {
                    messages: arrayUnion({ sId: userData.id, text: input, createdAt: new Date(), msgId: Date.now() }),
                    [`typing.${userData.id}`]: false 
                })
                setOpenEmoji(false); // Gửi xong thì đóng bảng emoji
                if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }

                const userIDs = [chatUser.rId, userData.id];
                userIDs.forEach(async (id) => {
                    const userChatsRef = doc(db, 'chats', id);
                    const userChatsSnapshot = await getDoc(userChatsRef);
                    if (userChatsSnapshot.exists()) {
                        const userChatData = userChatsSnapshot.data();
                        const chatIndex = userChatData.chatsData.findIndex((c) => c.messageId === messagesId);
                        if (chatIndex !== -1) {
                            userChatData.chatsData[chatIndex].lastMessage = input.slice(0, 30);
                            userChatData.chatsData[chatIndex].updatedAt = Date.now();
                            if (userChatData.chatsData[chatIndex].rId === userData.id) {
                                userChatData.chatsData[chatIndex].messageSeen = false;
                            }
                            await updateDoc(userChatsRef, { chatsData: userChatData.chatsData })
                        }
                    }
                })
            }
        } catch (error) { toast.error(error.message) }
        setInput("");
    }

    const sendImage = async (e) => {
        try {
            const fileUrl = await upload(e.target.files[0]);
            if (fileUrl && messagesId) {
                await updateDoc(doc(db, 'messages', messagesId), {
                    messages: arrayUnion({ sId: userData.id, image: fileUrl, createdAt: new Date(), msgId: Date.now() })
                })
                const userIDs = [chatUser.rId, userData.id];
                userIDs.forEach(async (id) => {
                    const userChatsRef = doc(db, 'chats', id);
                    const userChatsSnapshot = await getDoc(userChatsRef);
                    if (userChatsSnapshot.exists()) {
                        const userChatData = userChatsSnapshot.data();
                        const chatIndex = userChatData.chatsData.findIndex((c) => c.messageId === messagesId);
                        if (chatIndex !== -1) {
                            userChatData.chatsData[chatIndex].lastMessage = "Hình ảnh";
                            userChatData.chatsData[chatIndex].updatedAt = Date.now();
                            if (userChatData.chatsData[chatIndex].rId === userData.id) {
                                userChatData.chatsData[chatIndex].messageSeen = false;
                            }
                            await updateDoc(userChatsRef, { chatsData: userChatData.chatsData })
                        }
                    }
                })
            }
        } catch (error) { toast.error(error.message) }
    }

    const convertTimestamp = (timestamp) => {
        if (!timestamp) return "";
        let date;
        if (timestamp.toDate && typeof timestamp.toDate === 'function') { date = timestamp.toDate(); } 
        else { date = new Date(timestamp); }
        if (isNaN(date.getTime())) return "";
        const hour = date.getHours();
        const minute = date.getMinutes().toString().padStart(2, "0");
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${minute} ${ampm}`;
    }

    useEffect(() => {
        if (messagesId) {
            const unSub = onSnapshot(doc(db, 'messages', messagesId), (res) => {
                if(res.exists()){
                    const data = res.data();
                    setMessages(data.messages.reverse())
                    if (data.typing && data.typing[chatUser.userData.id]) setIsTyping(true);
                    else setIsTyping(false);
                }
            })
            return () => unSub()
        }
    }, [messagesId, chatUser])

    return chatUser ? (
        <div className={`chat-box ${chatVisible ? "" : "hidden"}`}>
            
            <div className="chat-mobile-sidebar">
                {chatData && chatData.map((item, index) => (
                    <div key={index} onClick={() => handleSwitchChat(item)} className={`mobile-avatar-item ${item.userData.id === chatUser.userData.id ? "active-chat" : ""}`}>
                        <img src={item.userData.avatar || assets.profile_img} alt="" />
                        {!item.messageSeen && item.userData.id !== chatUser.userData.id && <div className="notify-dot"></div>}
                    </div>
                ))}
            </div>

            <div className="chat-main-content">
                <div className="chat-user">
                    <img onClick={() => setChatVisible(false)} src={assets.arrow_icon} className='arrow' alt="Back" />
                    <img src={userProfile ? userProfile.avatar : assets.profile_img} alt="" />
                    <p>
                        {userProfile ? userProfile.name : "..."} 
                        {userProfile && Date.now() - userProfile.lastSeen <= 60000 ? <img className='dot' src={assets.green_dot} alt="Online" /> : null} 
                    </p>
                    <img onClick={() => setRightSidebarVisible(true)} src={assets.help_icon} alt="Help" />
                </div>

                <div className="chat-msg">
                    {isTyping && ( <div className="typing-indicator"><div className="typing-dot"></div><div className="typing-dot"></div><div className="typing-dot"></div></div> )}
                    {messages && messages.map((msg, index) => (
                        <div key={index} className={msg.sId === userData.id ? "s-msg" : "r-msg"}>
                            <div className="msg-container">
                                {msg.image && !msg.isDeleted ? <img className='msg-img' src={msg.image} alt="" /> : <p className={`msg ${msg.isDeleted ? "deleted" : ""}`}>{msg.text}</p>}
                                

                            <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                    
                                    {/* 1. Nút Xóa (Chỉ hiện cho tin mình gửi) */}
                                    {msg.sId === userData.id && !msg.isDeleted && msg.msgId && (
                                        <img onClick={() => deleteMessage(msg.msgId)} src={assets.trash_icon || "https://cdn-icons-png.flaticon.com/512/3405/3405244.png"} className="delete-btn" alt="Xóa" title="Thu hồi" />
                                    )}

                                    {/* 2. Nút Info (Hiện cho CẢ 2 BÊN để xem giờ) */}
                                    {!msg.isDeleted && (
                                        <img 
                                            onClick={() => setMsgInfo(msg)} 
                                            src={assets.info_icon || "https://cdn-icons-png.flaticon.com/512/1101/1101366.png"} 
                                            className="info-btn" 
                                            alt="Chi tiết" 
                                            title="Chi tiết tin nhắn"
                                        />
                                    )}
                                </div>

                            </div>
                            <div>
                                <img src={msg.sId === userData.id ? userData.avatar : chatUser.userData.avatar} alt="" />
                                <p>{convertTimestamp(msg.createdAt)}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="chat-input">
                    <input onChange={handleInputChange} onClick={() => setOpenEmoji(false)} value={input} type="text" placeholder='Send a message' onKeyDown={(e) => e.key === "Enter" ? sendMessage() : null} />
                    
                    {/* INPUT ẢNH */}
                    <input onChange={sendImage} type="file" id='image' accept='image/png ,image/jpeg' hidden />
                    
                    {/* NÚT GALLERY */}
                    <label htmlFor="image"><img src={assets.gallery_icon} alt="" /></label>
                    
                    {/* NÚT BẬT/TẮT EMOJI (Nếu không có icon, dùng link ảnh mạng) */}
                    <img onClick={() => setOpenEmoji(!openEmoji)} src={assets.emoji_icon || "https://cdn-icons-png.flaticon.com/512/1665/1665944.png"} alt="Emoji" className='emoji-btn'/>

                    {/* NÚT GỬI */}
                    <img onClick={sendMessage} src={assets.send_button} alt="" />

                    {/* BẢNG CHỌN EMOJI (Hiện khi openEmoji = true) */}
                    {openEmoji && (
                        <div className="emoji-picker-wrapper">
                            <EmojiPicker onEmojiClick={handleEmoji} width={300} height={400} />
                        </div>
                    )}

                    {/* --- MODAL POPUP CHI TIẾT TIN NHẮN --- */}
            {msgInfo && (
                <div className="msg-info-overlay" onClick={() => setMsgInfo(null)}>
                    <div className="msg-info-box" onClick={(e) => e.stopPropagation()}>
                        <h3>Chi tiết tin nhắn</h3>
                        <p><strong>Người gửi:</strong> {msgInfo.sId === userData.id ? "Bạn" : chatUser.userData.name}</p>
                        <p><strong>Thời gian gửi:</strong> {formatFullTime(msgInfo.createdAt)}</p>
                        <p><strong>Loại tin:</strong> {msgInfo.image ? "Hình ảnh" : "Văn bản"}</p>
                        <p><strong>Trạng thái:</strong> {msgInfo.sId === userData.id ? "Đã gửi" : "Đã nhận"}</p>
                        <button onClick={() => setMsgInfo(null)}>Đóng</button>
                    </div>
                </div>
            )}

                </div>
            </div>
        </div>
    )
    : <div className={`chat-welcome ${chatVisible ? "" : "hidden"}`}>
        <img src={assets.logo_big} alt='' />
        <p>Chat anytime, anywhere</p>
      </div>
}

export default ChatBox