import React, { useContext, useEffect, useState } from 'react'
import './RightSidebar.css'
import assets from '../../assets/assets'
import { logout } from '../../config/firebase'
import { AppContext } from '../../context/AppContext'
const RightSidebar = () => {

  const { chatUser, messages, rightSidebarVisible, setRightSidebarVisible } = useContext(AppContext);
  const [msgImages, setMsgImages] = useState([]);


  useEffect(() => {
    let temVar = [];
    messages.map((msg) => {
      if (msg.image) {
        temVar.push(msg.image)
      }
    })
    setMsgImages(temVar);
  }, [messages])

  return chatUser ? (
    <div className={`rs ${rightSidebarVisible ? "rs-show" : ""}`}>
      <div className="rs-mobile-header">
                <img onClick={() => setRightSidebarVisible(false)} src={assets.arrow_icon} alt="Back" />
                <p>Thông tin </p>
            </div>
      <div className="rs-profile">
        <img src={chatUser.userData.avatar} alt="" />
        <h3>{Date.now() - chatUser.userData.lastSeen <= 6000 ? <img src={assets.green_dot} className='dot' alt="" /> : null} {chatUser.userData.name} </h3>
        <p>{chatUser.userData.bio}</p>
      </div>
      <hr />

      <div className="rs-media">
        <p>Hình ảnh</p>
        <div>
          {msgImages.map((url, index) => (<img onClick={() => window.open(url)} key={index} src={url} alt='' />))}
        </div>
        
      </div>
      <button onClick={() => logout()} >Đăng xuất</button>
    </div>
  )
    : (
      <div className='rs'>
        <button onClick={() => logout()} >Đăng xuất</button>
      </div>
    )
}

export default RightSidebar