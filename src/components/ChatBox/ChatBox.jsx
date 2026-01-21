import React, { useContext, useEffect, useState } from 'react'
import './ChatBox.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext'
import { onSnapshot, arrayUnion, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { toast } from 'react-toastify'
import upload from '../../lib/upload'

const ChatBox = () => {

    const { userData, setMessages, chatUser, messages, messagesId, chatVisible, setChatVisible } = useContext(AppContext)
    const [input, setInput] = useState("")

    // ================= GỬI TIN NHẮN =================
    const sendMessage = async () => {
        try {
            if (input && messagesId) {
                await updateDoc(doc(db, 'messages', messagesId), {
                    messages: arrayUnion({
                        sId: userData.id,
                        text: input,
                        createdAt: new Date()
                    })
                })

                const userIDs = [chatUser.rId, userData.id];

                userIDs.forEach(async (id) => {
                    const userChatsRef = doc(db, 'chats', id);
                    const userChatsSnapshot = await getDoc(userChatsRef);

                    if (userChatsSnapshot.exists()) {
                        const userChatData = userChatsSnapshot.data();
                        
                        // Tìm đoạn chat theo messageId (đảm bảo đúng tên biến)
                        const chatIndex = userChatData.chatsData.findIndex(
                            (c) => c.messageId === messagesId
                        );

                        if (chatIndex !== -1) {
                            userChatData.chatsData[chatIndex].lastMessage = input.slice(0, 30);
                            userChatData.chatsData[chatIndex].updatedAt = Date.now();
                            
                            if (userChatData.chatsData[chatIndex].rId === userData.id) {
                                userChatData.chatsData[chatIndex].messageSeen = false;
                            }
                            
                            await updateDoc(userChatsRef, {
                                chatsData: userChatData.chatsData
                            })
                        }
                    }
                })
            }
        } catch (error) {
            toast.error(error.message)
        }
        setInput("");
    }

    const sendImage = async (e) => {
        try {
            const fileUrl = await upload(e.target.files[0]);

            if (fileUrl && messagesId) {
                await updateDoc(doc(db, 'messages', messagesId), {
                    messages: arrayUnion({
                        sId: userData.id,
                        image: fileUrl,
                        createdAt: new Date()
                    })
                })

                const userIDs = [chatUser.rId, userData.id];

                userIDs.forEach(async (id) => {
                    const userChatsRef = doc(db, 'chats', id);
                    const userChatsSnapshot = await getDoc(userChatsRef);

                    if (userChatsSnapshot.exists()) {
                        const userChatData = userChatsSnapshot.data();
                        const chatIndex = userChatData.chatsData.findIndex(
                            (c) => c.messageId === messagesId
                        );

                        if (chatIndex !== -1) {
                            userChatData.chatsData[chatIndex].lastMessage = "Hình ảnh";
                            userChatData.chatsData[chatIndex].updatedAt = Date.now();
                            
                            if (userChatData.chatsData[chatIndex].rId === userData.id) {
                                userChatData.chatsData[chatIndex].messageSeen = false;
                            }
                            
                            await updateDoc(userChatsRef, {
                                chatsData: userChatData.chatsData
                            })
                        }
                    }
                })
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // --- HÀM XỬ LÝ THỜI GIAN AN TOÀN (FIX LỖI CRASH) ---
    const convertTimestamp = (timestamp) => {
        // Nếu không có timestamp hoặc timestamp bị null -> Trả về rỗng ngay
        if (!timestamp) return "";
        
        // Kiểm tra kỹ xem có phải là Firestore Timestamp object không
        let date;
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
             date = timestamp.toDate();
        } else {
             // Nếu là Date object hoặc số milliseconds
             date = new Date(timestamp);
        }

        // Kiểm tra nếu date không hợp lệ
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
                    const listMessage = data.messages || data.message || [];
                    setMessages(listMessage.reverse())
                }
            })
            return () => {
                unSub();
            }
        }
    }, [messagesId])

    return chatUser ? (
        // Logic ẩn hiện: Nếu chatVisible=true (đang chat) -> Hiện. Nếu false -> Thêm class 'hidden'
        <div className={`chat-box ${chatVisible ? "" : "hidden"}`}>
            <div className="chat-user">
                <img src={chatUser.userData.avatar || assets.profile_img} alt="" />
                <p>
                    {chatUser.userData.name} 
                    {/* Thêm '?' để tránh lỗi nếu userData chưa tải xong */}
                    {Date.now() - chatUser.userData?.lastSeen <= 60000 ? <img className='dot' src={assets.green_dot} alt="" /> : null} 
                </p>
                <img src={assets.help_icon} alt="Help" />
                
                {/* Nút mũi tên để quay lại danh sách trên mobile */}
                <img onClick={() => setChatVisible(false)} src={assets.arrow_icon} className='arrow' alt="Back" />
            </div>

            <div className="chat-msg">
                {messages && messages.map((msg, index) => (
                    <div key={index} className={msg.sId === userData.id ? "s-msg" : "r-msg"}>
                        {msg.image 
                         ? <img className='msg-img' src={msg.image} alt="" />
                         : <p className="msg">{msg.text}</p>
                        }
                        <div>
                            <img src={msg.sId === userData.id ? userData.avatar : chatUser.userData.avatar} alt="" />
                            <p>{convertTimestamp(msg.createdAt)}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="chat-input">
                <input 
                    onChange={(e) => setInput(e.target.value)} 
                    value={input} 
                    type="text" 
                    placeholder='Send a message' 
                    onKeyDown={(e) => e.key === "Enter" ? sendMessage() : null}
                />
                <input onChange={sendImage} type="file" id='image' accept='image/png ,image/jpeg' hidden />
                <label htmlFor="image">
                    <img src={assets.gallery_icon} alt="" />
                </label>
                <img onClick={sendMessage} src={assets.send_button} alt="" />
            </div>
        </div>
    )
    : <div className={`chat-welcome ${chatVisible ? "" : "hidden"}`}>
        <img src={assets.logo_big} alt='' />
        <p>Chat anytime, anywhere</p>
      </div>
}

export default ChatBox