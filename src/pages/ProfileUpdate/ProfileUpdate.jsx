import React, { useContext, useEffect, useState } from 'react'
import './ProfileUpdate.css'
import assets from '../../assets/assets'
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../config/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import upload from '../../lib/upload';
import { AppContext } from '../../context/AppContext';

const ProfileUpdate = () => {

    const navigate = useNavigate();
    const [image, setImage] = useState(false);
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [uid, setUid] = useState("");
    const [prevImage, setPrevImage] = useState("");
    
    // 1. Sửa lỗi chính tả: setUserDate -> setUserData
    const { setUserData } = useContext(AppContext);

    const profileUpdate = async (event) => {
        event.preventDefault();
        try {
            if (!prevImage && !image) {
                toast.error("Upload profile picture");
                return; // Dừng lại nếu không có ảnh
            }

            const docRef = doc(db, 'users', uid);

            // 2. Logic cập nhật thông minh hơn
            let imgUrl = prevImage; // Mặc định giữ ảnh cũ

            // Nếu có chọn ảnh mới thì upload và lấy link mới
            if (image) {
                imgUrl = await upload(image);
                setPrevImage(imgUrl);
            }

            // Cập nhật Firestore (Dù có ảnh mới hay không cũng phải chạy dòng này)
            await updateDoc(docRef, {
                avatar: imgUrl,
                bio: bio,
                name: name
            });

            // Cập nhật lại Context và chuyển trang
            const snap = await getDoc(docRef);
            setUserData(snap.data());
            navigate('/chat');

        } catch (error) {
            console.error(error);
            toast.error(error.message);
        }
    }

    useEffect(() => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUid(user.uid)
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.data().name) {
                    setName(docSnap.data().name);
                }
                if (docSnap.data().bio) {
                    setBio(docSnap.data().bio);
                }
                if (docSnap.data().avatar) {
                    setPrevImage(docSnap.data().avatar)
                }
            }
            else {
                navigate('/')
            }
        })
    }, []) // 3. Quan trọng: Thêm [] để không bị lặp vô tận

    return (
        <div className='profile'>
            <div className="profile-container">
                <form onSubmit={profileUpdate} >
                    <h3>Profile Details</h3>
                    <label htmlFor="avatar">
                        <input
                            onChange={(e) => setImage(e.target.files[0])}
                            type="file" id='avatar' accept='.png, .jpg, .jpeg' hidden />
                        <img src={image ? URL.createObjectURL(image) : prevImage ? prevImage : assets.avatar_icon} alt="" />
                        upload profile image
                    </label>
                    <input onChange={(e) => setName(e.target.value)} value={name} type="text" placeholder='Your Name' required />
                    
                    {/* 4. Sửa lỗi: e.target.bio -> e.target.value */}
                    <textarea onChange={(e) => setBio(e.target.value)} value={bio} placeholder='Write profile bio' required></textarea>
                    
                    <button type='submit'>Save Profile</button>
                </form>
                
                {/* Ảnh bên phải cũng hiển thị đúng logic */}
                <img className='profile-pic' src={image ? URL.createObjectURL(image) : prevImage ? prevImage : assets.logo_icon} alt="" />
            </div>
        </div>
    )
}

export default ProfileUpdate