import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import Editor from "@monaco-editor/react";

function App() {
  const [socket, setSocket] = useState(null);

  const [room, setRoom] = useState("");
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  const [code, setCode] = useState("// Start coding here...");
  const [language, setLanguage] = useState("javascript");
  const [hostId, setHostId] = useState(null);

  const [output, setOutput] = useState("");

  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [versions, setVersions] = useState([]);

  const [showVersions, setShowVersions] = useState(false);

  const chatEndRef = useRef(null);
  const codeRef = useRef(code);

  // Always keep latest code
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // ================= JOIN ROOM =================
  const joinRoom = () => {
    if (room.trim() !== "" && username.trim() !== "") {
      const newSocket = io("http://localhost:5001");
      setSocket(newSocket);
      newSocket.emit("join_room", { room, username });
      setJoined(true);
    }
  };

  // ================= LEAVE ROOM =================
  const leaveRoom = () => {
    socket?.disconnect();
    setSocket(null);
    setJoined(false);
    setRoom("");
    setUsername("");
    setUsers([]);
    setMessages([]);
    setVersions([]);
    setCode("// Start coding here...");
    setOutput("");
    setHostId(null);
  };

  // ================= SOCKET LISTENERS =================
  useEffect(() => {
    if (!socket) return;

    socket.on("room_data", (data) => {
      setUsers(data.users);
      setHostId(data.host);
      setLanguage(data.language);
    });

    socket.on("language_updated", (newLang) => {
      setLanguage(newLang);
    });

    socket.on("receive_code", (data) => setCode(data));

    socket.on("receive_message", (data) =>
      setMessages((prev) => [...prev, data])
    );

    socket.on("update_versions", (data) => setVersions(data));

    socket.on("receive_output", (data) => {
      console.log("Received Output:", data);
      setOutput(`⚡ Executed by ${data.ranBy}\n\n${data.output}`);
    });

    return () => {
      socket.off("room_data");
      socket.off("language_updated");
      socket.off("receive_code");
      socket.off("receive_message");
      socket.off("update_versions");
      socket.off("receive_output");
    };
  }, [socket]);

  // ================= AUTO SAVE =================
  useEffect(() => {
    if (!socket || !joined) return;

    const interval = setInterval(() => {
      socket.emit("save_version", {
        room,
        code: codeRef.current,
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [socket, joined]);

  // ================= AUTO SCROLL CHAT =================
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ================= CODE CHANGE =================
  const handleEditorChange = (value) => {
    const newCode = value || "";
    setCode(newCode);
    socket?.emit("send_code", { room, code: newCode });
  };

  // ================= SEND MESSAGE =================
  const sendMessage = () => {
    if (message.trim() !== "") {
      socket?.emit("send_message", { room, message });
      setMessage("");
    }
  };

  // ================= RESTORE VERSION =================
  const restoreVersion = (savedCode) => {
    setCode(savedCode);
    socket?.emit("send_code", { room, code: savedCode });
  };

  // ================= RUN CODE =================
  const runCode = async () => {
    // if (!isHost) return;

    try {
      setOutput("Running...");

      const res = await fetch("http://localhost:5001/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, room, username }),
      });

      // const data = await res.json();
      // setOutput(data.output);
    } catch (err) {
      setOutput("Error running code");
    }
  };

  const isHost = socket?.id === hostId;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#1e1e1e", color: "white" }}>
      
      {/* HEADER */}
      <div style={{ padding: "15px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>🚀 Collaborative Code Editor</h2>

        {joined && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={runCode}
              // disabled={!isHost}
              style={{
                background:"#25D366",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                color: "black",
                cursor: "pointer",
              }}
            >
              ▶ Run
            </button>

            <button
              onClick={leaveRoom}
              style={{
                background: "#ff4d4d",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                color: "white",
                cursor: "pointer",
              }}
            >
              Leave
            </button>
          </div>
        )}
      </div>

      {!joined ? (
        <div 
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "linear-gradient(135deg, #907fdc, #77bdf2)",
          }}
        >
          <div
            style={{
              width:"400px",
              padding: "40px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(15px)",
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
            <h2 
              style={{
                marginBottom: "30px",
                textAlign: "center",
                fontWeight: "600",
                letterSpacing: "1px",}}>
              Join a Room 🚀
            </h2>

            <input
              type="text"
              placeholder="Enter Your Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                outline: "none",
                background: "#1e1e1e",
                color: "white",
            }}
          />

            <input
              type="text"
              placeholder="Enter Room ID"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                outline: "none",
                background: "#1e1e1e",
                color: "white",
              }}
            />

            <button
              onClick={joinRoom}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                background: "#25D366",
                color: "black",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "0.3s",
            }}
            onMouseOver={(e) =>
            (e.target.style.background = "#1ebe5d")
            }
            onMouseLeave={(e) => {
              e.target.style.background = "#25D366";
            }}
          >
            Join Room
          </button>
        </div>
      </div>
      ) : (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 350px" }}>
          
          {/* EDITOR + OUTPUT */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Editor
              height="70%"
              language={language}
              theme="vs-dark"
              value={code}
              onChange={handleEditorChange}
              options={{
                fontSize: 15,
                minimap: { enabled: false },
                wordWrap: "on",
                automaticLayout: true,
              }}
            />

            <div style={{ height: "30%", background: "#111", padding: "10px", borderTop: "1px solid #333", overflowY: "auto" }}>
              <strong>Output:</strong>
              <pre style={{ whiteSpace: "pre-wrap" }}>{output}</pre>
            </div>
          </div>

          {/* SIDEBAR */}
          <div style={{ background: "#252526", padding: "15px", borderLeft: "1px solid #333", display: "flex", flexDirection: "column" }}>
            
            <h3>👥 Online Users ({users.length})</h3>
            {users.map((user) => (
              <div key={user.id}>
                🟢 {user.username}
                {user.id === hostId && " 👑"}
              </div>
            ))}

            <hr style={{ margin: "15px 0" }} />

            {/* CHAT */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {messages.map((msg, index) => {
                  const isMine = msg.sender === username;
                  const isSystem = msg.sender === "system";

                  if (isSystem) {
                    return (
                      <div key={index} style={{ textAlign: "center", fontSize: "12px", color: "#aaa" }}>
                        {msg.message}
                      </div>
                    );
                  }

                  return (
                    <div key={index} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "75%",
                        padding: "8px 12px",
                        borderRadius: "16px",
                        background: isMine ? "#25D366" : "#2a2a2a",
                        color: isMine ? "black" : "white",
                        fontSize: "13px",
                      }}>
                        {!isMine && (
                          <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "2px", opacity: 0.7 }}>
                            {msg.sender}
                          </div>
                        )}
                        {msg.message}
                        <div style={{ fontSize: "9px", marginTop: "4px", textAlign: "right", opacity: 0.7 }}>
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef}></div>
              </div>

              <div style={{ display: "flex", marginTop: "10px" }}>
                <input
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "20px",
                    border: "1px solid #333",
                    background: "#1a1a1a",
                    color: "white",
                  }}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type message..."
                />
                <button
                  onClick={sendMessage}
                  style={{
                    marginLeft: "8px",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                  }}
                >
                  ➤
                </button>
              </div>
            </div>

            <hr style={{ margin: "15px 0" }} />

            {/* LANGUAGE SELECT */}
            <h3>🖥 Language</h3>
            <select
              value={language}
              disabled={!isHost}
              onChange={(e) =>
                socket?.emit("change_language", {
                  room,
                  language: e.target.value,
                })
              }
              style={{
                padding: "6px",
                background: isHost ? "#1a1a1a" : "#333",
                color: "white",
                border: "1px solid #333",
                cursor: isHost ? "pointer" : "not-allowed",
              }}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
            </select>

            <hr style={{ margin: "15px 0" }} />

            {/* VERSION HISTORY */}
            <div onClick={() => setShowVersions(!showVersions)} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
              <h3 style={{ margin: 0 }}>💾 Version History</h3>
              <span>{showVersions ? "▲" : "▼"}</span>
            </div>

            {showVersions && (
              <div style={{ marginTop: "10px", maxHeight: "200px", overflowY: "auto" }}>
                {versions.map((v, index) => (
                  <button
                    key={index}
                    onClick={() => restoreVersion(v.code)}
                    style={{
                      width: "100%",
                      marginBottom: "6px",
                      padding: "6px",
                      background: "#1a1a1a",
                      border: "1px solid #333",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    Restore {v.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;