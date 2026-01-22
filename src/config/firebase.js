import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getFirestore, query, setDoc ,getDocs ,where } from "firebase/firestore";
import { toast } from "react-toastify";

const firebaseConfig = {
  apiKey: "AIzaSyD1nShmLhQzj0gamP6TR5n-naD5Hq_t58M",
  authDomain: "chat-app-js-bc1d4.firebaseapp.com",
  projectId: "chat-app-js-bc1d4",
  storageBucket: "chat-app-js-bc1d4.firebasestorage.app",
  messagingSenderId: "222999741531",
  appId: "1:222999741531:web:d63c955ce547c329d52b7e",
  measurementId: "G-G09Y25T3NC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Khởi tạo Auth và DB
const auth = getAuth(app);
const db = getFirestore(app);

// 1. Hàm đăng ký (Signup)
const signup = async (username, email, password) => {
    try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const user = res.user;

        await setDoc(doc(db, "users", user.uid), {
            id: user.uid,
            username: username.toLowerCase(),
            email,
            name: "",
            avatar: "",
            bio: "Hey, there I am using chat app",
            lastSeen: Date.now()
        })

        await setDoc(doc(db, "chats", user.uid), {
            chatsData: [] 
        })
        
    } catch (error) {
        console.error(error)
        if (error.code) {
             toast.error(error.code.split('/')[1].split('-').join(" "));
        } else {
             toast.error(error.message);
        }
    }
}

// 2. Hàm đăng nhập (Login)
const login = async(email, password) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error(error);
        if (error.code) {
             toast.error(error.code.split('/')[1].split('-').join(" "));
        } else {
             toast.error(error.message);
        }
    }
}

// 3. Hàm đăng xuất (Logout)
const logout = async () => {
    try {
        await signOut(auth)
    } catch (error) {
        console.error(error);
        if (error.code) {
             toast.error(error.code.split('/')[1].split('-').join(" "));
        } else {
             toast.error(error.message);
        }
    }
}

const resetPass = async(email)=>{
    if(!email){
        toast.error("Enter your email");
        return null;
    }
    try{
        const userRef = collection(db,'users');
        const q=query(userRef,where("email","==",email));
        const querySnap =await getDocs(q);
        if(!querySnap.empty){
            await sendPasswordResetEmail(auth,email);
            toast.success("Reset Email Sent")
        }
        else{
            toast.error("Email doesn't exsits")
        }

    }catch(error){
        console.error(error);
        toast.error(error.message)
    }
}

export { auth, db, signup, login, logout ,resetPass };