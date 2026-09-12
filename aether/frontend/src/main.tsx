import React from "react";
import { createRoot } from "react-dom/client";
function App() {
  return <main style={{padding:32,fontFamily:"system-ui"}}><h1>AETHER</h1>
    <p>Configurable personal AI assistant — implementation foundation.</p></main>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
