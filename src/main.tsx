
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[DEBUG] main.tsx: about to render App");
createRoot(document.getElementById("root")!).render(<App />);
console.log("[DEBUG] main.tsx: render called");
