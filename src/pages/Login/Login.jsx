import React, { use, useState } from 'react'
import './Login.css'
import assets from '../../assets/assets'
import { signup, login, resetPass } from '../../config/firebase'
import { toast } from 'react-toastify'
const Login = () => {
  const [currState, setCurrState] = useState("Sign up")
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);


  const onSubmaiHandler = (event) => {
    event.preventDefault();
    if (!agree) {
      toast.error("Đồng ý với điều khoản sử dụng & chính sách bảo mật!");
      return;
    }
    if (currState === "Sign up") {
      signup(userName, email, password)
    }
    else {
      login(email, password)
    }
  }


  return (
    <div className='login'>
      <img src={assets.logo_big} alt="" className="logo" />
      <form onSubmit={onSubmaiHandler} className="login-form">
        <h2>{currState === "Sign up" ? "Đăng ký" : "Đăng nhập"}</h2>
        {currState === "Sign up" ?
          <input
            onChange={(e) => setUserName(e.target.value)}
            value={userName}
            type="text"
            placeholder='Tên người dùng'
            className='form-input'
            required
          /> : null}
        <input onChange={(e) => setEmail(e.target.value)}
          value={email}
          type="email"
          placeholder='Địa chỉ Email'
          className='form-input'
        />
        <input onChange={(e) => setPassword(e.target.value)}
          value={password}
          type="password"
          placeholder='Mật khẩu'
          className='form-input'
        />
        <button type="submit" >{currState === "Sign up" ? "Tạo tài khoản" : "Đăng nhập ngay"}</button>
        <div className="login-term">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <p className="login-toggle">
            <span onClick={() => setShowTerms(true)}>Đồng ý với điều khoản sử dụng & chính sách bảo mật</span>
          </p>
        </div>
        <div className="login-forgot">
          {
            currState === "Sign up"
              ? <p className="login-toggle">Đã có tài khoản?<span onClick={() => setCurrState("Login")}>Đăng nhập tại đây</span></p>
              : <p className="login-toggle">Chưa có tài khoản? <span onClick={() => setCurrState("Sign up")}>Đăng ký tại đây</span></p>
          }
          {currState === "Login" ? <p className="login-toggle">Quên mật khẩu? <span onClick={() => resetPass(email)}>Đặt lại tại đây</span></p> : null}

        </div>

        {/* --- PHẦN POPUP ĐIỀU KHOẢN --- */}
        {showTerms && (
          <div className="term-popup">
            <div className="term-content">
              <h3>Điều khoản sử dụng & Chính sách riêng tư</h3>
              <hr />
              <div className="term-text">
                <p>1. Chúng tôi cam kết bảo mật thông tin người dùng...</p>
                <p>2. Người dùng không được sử dụng ngôn từ đả kích...</p>
                <p>3. Tài khoản vi phạm sẽ bị khóa vĩnh viễn...</p>
              </div>
              <button type="button" onClick={() => setShowTerms(false)}>Đóng</button>
            </div>
          </div>
        )}

      </form>
    </div>
  )
}

export default Login