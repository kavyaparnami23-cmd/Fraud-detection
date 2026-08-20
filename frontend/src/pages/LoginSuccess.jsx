import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("token", token);
      navigate("/analytics");
    }
  }, []);

  return (
    <div className="h-screen flex items-center justify-center text-white bg-gray-900">
      Logging in...
    </div>
  );
}
