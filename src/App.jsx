import React, { useContext, useEffect } from 'react'
import { Routes,Route, useNavigate } from 'react-router-dom'
import Login from './pages/Login/Login'
import Chat from './pages/Chat/Chat'
import ProfileUpdate from './pages/ProfileUpdate/ProfileUpdate'  
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './config/firebase'
import { AppContext } from './context/AppContext'
const App = () => {
  const navigate = useNavigate();
  const {loadUserData, appFullImage, setAppFullImage} =useContext(AppContext)

  useEffect(()=>{
    onAuthStateChanged(auth,async(user)=>{
      if(user){
       
        await loadUserData(user.uid);
      }else{
        navigate('/')
      }
    })
  },[])
  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<ProfileUpdate />} />
      </Routes>
      {appFullImage && (
        <div className="image-zoom-overlay" onClick={() => setAppFullImage(null)}>
            <span className="close-zoom-btn" onClick={() => setAppFullImage(null)}>&times;</span>
            <img 
                className="image-zoom-content" 
                src={appFullImage} 
                alt="Full View" 
                onClick={(e) => e.stopPropagation()} 
            />
        </div>
      )}

    </>
  )
}

export default App