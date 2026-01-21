// File: src/lib/upload.js

const upload = async (file) => {
  // --- 1. ĐIỀN THÔNG TIN CỦA BẠN VÀO ĐÂY ---
  const cloud_name = "da6fj6ccn";  // Ví dụ: "duongxuan"
  const upload_preset = "chatapp_preset"; // Ví dụ: "chatapp_upload"

  // ------------------------------------------

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", upload_preset);

  try {
    // Gọi API của Cloudinary để upload ảnh
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
        throw new Error("Không thể upload ảnh lên Cloudinary");
    }

    const data = await response.json();
    
    // Trả về đường dẫn ảnh (secure_url) để lưu vào Firebase Database
    return data.secure_url;

  } catch (error) {
    console.error("Lỗi upload:", error);
    throw error; // Ném lỗi ra để bên ngoài (ProfileUpdate) bắt được
  }
}

export default upload;