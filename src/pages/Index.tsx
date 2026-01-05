import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to dashboard (later will check auth status)
    navigate("/dashboard");
  }, [navigate]);

  return null;
};

export default Index;
