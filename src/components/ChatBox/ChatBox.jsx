import React, { useContext, useEffect, useState, useRef, useCallback } from 'react'
import './ChatBox.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext'
import { onSnapshot, arrayUnion, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { toast } from 'react-toastify'
import upload from '../../lib/upload'
import EmojiPicker from 'emoji-picker-react'

const ChatBox = () => {

    const { userData, chatUser, messages, messagesId, chatVisible, setChatVisible, setRightSidebarVisible, chatData, setChatUser, setMessagesId, setMessages, setAppFullImage } = useContext(AppContext)
    
    // --- STATES ---
    const [input, setInput] = useState("")
    const [userProfile, setUserProfile] = useState(null)
    const [isTyping, setIsTyping] = useState(false)
    const [openEmoji, setOpenEmoji] = useState(false)
    const [msgInfo, setMsgInfo] = useState(null)
    const [editingMsg, setEditingMsg] = useState(null)

    // --- REFS ---
    const typingTimeoutRef = useRef(null)
    const inputRef = useRef(null)

    // --- 1. LẮNG NGHE REALTIME ---
    useEffect(() => {
        if (chatUser?.userData?.id) {
            setUserProfile(chatUser.userData);
            const unSub = onSnapshot(doc(db, "users", chatUser.userData.id), (docSnapshot) => {
                if (docSnapshot.exists()) {
                    setUserProfile(docSnapshot.data());
                }
            });
            return () => unSub();
        }
    }, [chatUser])

    useEffect(() => {
        if (messagesId) {
            const unSub = onSnapshot(doc(db, 'messages', messagesId), (res) => {
                if (res.exists()) {
                    const data = res.data();
                    setMessages(data.messages.reverse());
                    // Check typing status
                    const isOtherUserTyping = data.typing && data.typing[chatUser.userData.id];
                    setIsTyping(!!isOtherUserTyping);
                }
            });
            return () => unSub();
        }
    }, [messagesId, chatUser, setMessages])


    // --- 2. HÀM HỖ TRỢ (UTILS) ---
    
    // Cập nhật tin nhắn cuối cùng ra màn hình danh sách chat (Dùng Promise.all để tối ưu tốc độ)
    const updateChatListLastMessage = useCallback(async (content) => {
        const userIDs = [chatUser.rId, userData.id];
        
        await Promise.all(userIDs.map(async (id) => {
            const userChatsRef = doc(db, 'chats', id);
            const userChatsSnapshot = await getDoc(userChatsRef);
            
            if (userChatsSnapshot.exists()) {
                const userChatData = userChatsSnapshot.data();
                const chatIndex = userChatData.chatsData.findIndex((c) => c.messageId === messagesId);
                
                if (chatIndex !== -1) {
                    userChatData.chatsData[chatIndex].lastMessage = content; // Hiển thị full không cắt chữ
                    userChatData.chatsData[chatIndex].updatedAt = Date.now();
                    
                    if (userChatData.chatsData[chatIndex].rId === userData.id) {
                        userChatData.chatsData[chatIndex].messageSeen = false;
                    }
                    await updateDoc(userChatsRef, { chatsData: userChatData.chatsData });
                }
            }
        }));
    }, [chatUser, userData.id, messagesId]);

    const formatFullTime = (timestamp) => {
        if (!timestamp) return "N/A";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')} - Ngày ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    }

    const convertTimestamp = (timestamp) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        if (isNaN(date.getTime())) return "";
        const hour = date.getHours();
        const minute = date.getMinutes().toString().padStart(2, "0");
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${minute} ${ampm}`;
    }

    // --- 3. XỬ LÝ SỰ KIỆN (HANDLERS) ---

    // Xử lý nhập liệu + Auto Resize Textarea + Typing Status
    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);

        // Auto resize height
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }

        if (!messagesId || editingMsg) return;

        // Debounce typing status
        if (!typingTimeoutRef.current) {
             updateDoc(doc(db, 'messages', messagesId), { [`typing.${userData.id}`]: true }).catch(console.error);
        }
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        typingTimeoutRef.current = setTimeout(() => {
            updateDoc(doc(db, 'messages', messagesId), { [`typing.${userData.id}`]: false }).catch(console.error);
            typingTimeoutRef.current = null;
        }, 2000);
    }

    // Gửi tin nhắn
    const sendMessage = async () => {
        if (editingMsg) { saveEdit(); return; }

        try {
            if (input && messagesId) {
                const textToSend = input; 
                setInput(""); // Clear input ngay lập tức cho mượt
                if (inputRef.current) inputRef.current.style.height = "24px"; // Reset height

                await updateDoc(doc(db, 'messages', messagesId), {
                    messages: arrayUnion({ 
                        sId: userData.id, 
                        text: textToSend, 
                        createdAt: new Date(), 
                        msgId: Date.now(), 
                        isEdited: false 
                    }),
                    [`typing.${userData.id}`]: false 
                })

                setOpenEmoji(false);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                updateChatListLastMessage(textToSend);
            }
        } catch (error) { toast.error(error.message) }
    }

    // Gửi ảnh
    const sendImage = async (e) => {
        if(editingMsg || !e.target.files[0]) return; 
        try {
            const fileUrl = await upload(e.target.files[0]);
            if (fileUrl && messagesId) {
                await updateDoc(doc(db, 'messages', messagesId), {
                    messages: arrayUnion({ sId: userData.id, image: fileUrl, createdAt: new Date(), msgId: Date.now() })
                })
                updateChatListLastMessage("Hình ảnh");
            }
        } catch (error) { toast.error(error.message) }
    }

    // Sửa tin nhắn
    const handleEditClick = useCallback((msg) => {
        setEditingMsg(msg);
        setInput(msg.text);
        setOpenEmoji(false);
        if (inputRef.current) {
            setTimeout(() => {
                inputRef.current.focus();
                // Trigger auto resize khi click edit
                inputRef.current.style.height = "auto";
                inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
            }, 100); 
        }
    }, []);

    const saveEdit = async () => {
        if (!input.trim()) { toast.warning("Nội dung không được để trống!"); return; }
        try {
            const msgRef = doc(db, 'messages', messagesId);
            const snap = await getDoc(msgRef);
            if (snap.exists()) {
                const data = snap.data();
                const allMessages = data.messages;
                
                const updatedMessages = allMessages.map((msg) => 
                    msg.msgId === editingMsg.msgId ? { ...msg, text: input, isEdited: true } : msg
                );

                await updateDoc(msgRef, { messages: updatedMessages });

                // Nếu sửa tin nhắn cuối cùng thì cập nhật lại sidebar
                if (allMessages.length > 0 && allMessages[allMessages.length - 1].msgId === editingMsg.msgId) {
                    updateChatListLastMessage(input);
                }
            }
            setEditingMsg(null);
            setInput("");
            if (inputRef.current) inputRef.current.style.height = "24px";
            toast.success("Đã chỉnh sửa tin nhắn!");
        } catch (error) { toast.error("Lỗi khi sửa: " + error.message); }
    }

    const cancelEdit = useCallback(() => {
        setEditingMsg(null);
        setInput("");
        if (inputRef.current) inputRef.current.style.height = "24px";
    }, []);

    // Xóa tin nhắn
    const deleteMessage = async (msgId) => {
        if (!msgId) return;
        if(!window.confirm("Bạn có chắc muốn thu hồi tin nhắn này?")) return;
        try {
            const msgRef = doc(db, 'messages', messagesId);
            const snap = await getDoc(msgRef);
            if (snap.exists()) {
                const data = snap.data();
                const allMessages = data.messages;
                const isLastMessage = allMessages.length > 0 && allMessages[allMessages.length - 1].msgId === msgId;
                
                const updatedMessages = allMessages.map((msg) => 
                    msg.msgId === msgId ? { ...msg, isDeleted: true, text: "Tin nhắn đã bị thu hồi", image: "" } : msg
                );
                
                await updateDoc(msgRef, { messages: updatedMessages });
                if (isLastMessage) { updateChatListLastMessage("Tin nhắn đã bị thu hồi"); }
            }
        } catch (error) { toast.error("Lỗi: " + error.message); }
    }

    const handleSwitchChat = async (item) => {
        setChatUser(item);
        setMessagesId(item.messageId);
        setIsTyping(false);
        setOpenEmoji(false);
        setEditingMsg(null);
        setInput(""); 
        if(inputRef.current) inputRef.current.style.height = "24px";

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

    const handleCall = () => toast.info("Tính năng Gọi thoại đang phát triển!");
    const handleVideoCall = () => toast.info("Tính năng Gọi Video đang phát triển!");


    // --- 4. RENDER UI ---
    if (!chatUser) {
        return (
            <div className={`chat-welcome ${chatVisible ? "" : "hidden"}`}>
                <img src={assets.logo_big} alt='' />
                <p>Chat anytime, anywhere</p>
            </div>
        )
    }
// === LOGIC LỌC TIN NHẮN THEO THỜI GIAN XÓA ===
    let filteredMessages = messages;
    
    if (chatUser.resetTimestamp) {
        filteredMessages = messages.filter(msg => {
            // Lấy thời gian gửi của tin nhắn
            const msgDate = msg.createdAt.toDate ? msg.createdAt.toDate().getTime() : new Date(msg.createdAt).getTime();
            
            // Chỉ hiện tin nhắn được gửi SAU KHI tạo đoạn chat này
            return msgDate > chatUser.resetTimestamp;
        });
    }

    return (
        <div className={`chat-box ${chatVisible ? "" : "hidden"}`}>
            
            {/* LEFT SIDEBAR (MOBILE) */}
            <div className="chat-mobile-sidebar">
                {chatData && chatData.map((item, index) => (
                    <div key={index} onClick={() => handleSwitchChat(item)} className={`mobile-avatar-item ${item.userData.id === chatUser.userData.id ? "active-chat" : ""}`}>
                        <img src={item.userData.avatar || assets.profile_img} alt="" />
                        {!item.messageSeen && item.userData.id !== chatUser.userData.id && <div className="notify-dot"></div>}
                    </div>
                ))}
            </div>

            {/* MAIN CONTENT */}
            <div className="chat-main-content">
                
                {/* HEADER */}
                <div className="chat-user">
                    <img onClick={() => setChatVisible(false)} src={assets.arrow_icon} className='arrow' alt="Back" />
                    <img src={userProfile ? userProfile.avatar : assets.profile_img} alt="" />
                    <p>
                        {userProfile ? userProfile.name : "..."} 
                        {userProfile && Date.now() - userProfile.lastSeen <= 60000 && <img className='dot' src={assets.green_dot} alt="Online" />} 
                    </p>
                    <img onClick={handleCall} src={assets.phone_icon || "https://cdn-icons-png.flaticon.com/512/126/126509.png"} className="header-icon" alt="Call" />
                    <img onClick={handleVideoCall} src={assets.video_icon || "https://cdn-icons-png.flaticon.com/512/4945/4945926.png"} className="header-icon" alt="Video Call" />
                    <img onClick={() => setRightSidebarVisible(true)} src={assets.help_icon} alt="Help" className="header-icon" />
                </div>

                {/* MESSAGES LIST */}
                <div className="chat-msg">
                    {isTyping && ( <div className="typing-indicator"><div className="typing-dot"></div><div className="typing-dot"></div><div className="typing-dot"></div></div> )}

                    {filteredMessages && filteredMessages.map((msg, index) => (
                        <div key={index} className={msg.sId === userData.id ? "s-msg" : "r-msg"}>
                            <div className="msg-container">
                                {msg.image && !msg.isDeleted 
                                    ? <img className='msg-img' src={msg.image} alt="" onClick={() => setAppFullImage(msg.image)} /> 
                                    : <div style={{display:'flex', flexDirection:'column'}}>
                                        <p className={`msg ${msg.isDeleted ? "deleted" : ""}`}>{msg.text}</p>
                                        {msg.isEdited && !msg.isDeleted && <span className="edited-label">(đã sửa)</span>}
                                      </div>
                                }
                                
                                <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                    {msg.sId === userData.id && !msg.isDeleted && msg.msgId && (
                                        <img onClick={() => deleteMessage(msg.msgId)} src={assets.trash_icon || "https://cdn-icons-png.flaticon.com/512/3405/3405244.png"} className="delete-btn" alt="Xóa" title="Thu hồi" />
                                    )}
                                    {msg.sId === userData.id && !msg.isDeleted && msg.msgId && !msg.image && (
                                        <img onClick={() => handleEditClick(msg)} src={assets.edit_icon || "https://cdn-icons-png.flaticon.com/512/1159/1159633.png"} className="edit-btn" alt="Sửa" title="Chỉnh sửa" />
                                    )}
                                    {!msg.isDeleted && (
                                        <img onClick={() => setMsgInfo(msg)} src={assets.info_icon || "https://cdn-icons-png.flaticon.com/512/1101/1101366.png"} className="info-btn" alt="Chi tiết" title="Chi tiết tin nhắn" />
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

                {/* INPUT AREA (Đã chuyển sang Textarea) */}
                <div className={`chat-input ${editingMsg ? "editing" : ""}`}>
                    {editingMsg && <span className="cancel-edit" onClick={cancelEdit}>Hủy sửa ✕</span>}

                    <input 
                        ref={inputRef}
                        onChange={handleInputChange} 
                        onClick={() => setOpenEmoji(false)} 
                        value={input} 
                        placeholder={editingMsg ? 'Đang chỉnh sửa...' : 'Nhập tin nhắn...'} 
                        rows={1}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    />
                    
                    {!editingMsg && (
                        <>
                            <input onChange={sendImage} type="file" id='image' accept='image/png ,image/jpeg' hidden />
                            <label htmlFor="image"><img src={assets.gallery_icon} alt="" /></label>
                        </>
                    )}
                    
                    <img onClick={() => setOpenEmoji(!openEmoji)} src={assets.emoji_icon || "https://cdn-icons-png.flaticon.com/512/1665/1665944.png"} alt="Emoji" className='emoji-btn'/>
                    <img onClick={sendMessage} src={assets.send_button} alt={editingMsg ? "Lưu" : "Gửi"} style={editingMsg ? {filter: "hue-rotate(90deg)"} : {}} />

                    {openEmoji && (
                        <div className="emoji-picker-wrapper">
                            <EmojiPicker onEmojiClick={(e) => setInput(prev => prev + e.emoji)} width={300} height={400} />
                        </div>
                    )}
                </div>
            </div>

            {/* INFO MODAL */}
            {msgInfo && (
                <div className="msg-info-overlay" onClick={() => setMsgInfo(null)}>
                    <div className="msg-info-box" onClick={(e) => e.stopPropagation()}>
                        <h3>Chi tiết tin nhắn</h3>
                        <p><strong>Người gửi:</strong> {msgInfo.sId === userData.id ? "Bạn" : chatUser.userData.name}</p>
                        <p><strong>Thời gian gửi:</strong> {formatFullTime(msgInfo.createdAt)}</p>
                        <p><strong>Loại tin:</strong> {msgInfo.image ? "Hình ảnh" : "Văn bản"}</p>
                        <p><strong>Trạng thái:</strong> {msgInfo.isDeleted ? "Đã thu hồi" : (msgInfo.isEdited ? "Đã chỉnh sửa" : "Đã gửi")}</p>
                        <button onClick={() => setMsgInfo(null)}>Đóng</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ChatBox