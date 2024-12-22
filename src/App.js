import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CircularProgress from "@mui/material/CircularProgress";
import "./App.css";

function App() {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");

  // Bluetooth states
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const [bluetoothServer, setBluetoothServer] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [sendingStatus, setSendingStatus] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");

  // Key for storing device info in local storage
  const LOCAL_STORAGE_DEVICE_ID_KEY = "myBleDeviceId";

  // 8 colorblind-friendly colors
  const colors = [
    { value: "#FF0000", label: "Red" },
    { value: "#0000FF", label: "Blue" },
    { value: "#00FF00", label: "Green" },
    { value: "#FF1493", label: "Pink" },
    { value: "#FFA500", label: "Orange" },
    { value: "#800080", label: "Purple" },
    { value: "#00FFFF", label: "Cyan" },
    { value: "#FFFFFF", label: "White" },
    // Make sure Teal (#16A085) is also defined if using it
    // but in your code, you replaced it with #00FFFF (Cyan).
    // If you want Teal instead of Cyan, swap it in the array above:
    // { value: "#16A085", label: "Teal" },
  ];

  // ----------------- Local Storage for Players -----------------
  useEffect(() => {
    const savedPlayers = localStorage.getItem("players");
    if (savedPlayers) setPlayers(JSON.parse(savedPlayers));
  }, []);

  useEffect(() => {
    localStorage.setItem("players", JSON.stringify(players));
  }, [players]);

  // ----------------- Attempt Reconnect on Page Load -----------------
  useEffect(() => {
    const storedDeviceId = localStorage.getItem(LOCAL_STORAGE_DEVICE_ID_KEY);
    if (storedDeviceId) {
      reconnectToRememberedDevice(storedDeviceId);
    }
  }, []);

  async function reconnectToRememberedDevice(deviceId) {
    try {
      console.log("Attempting to reconnect to deviceId:", deviceId);

      // Some browsers might still show a prompt
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["0000ffe0-0000-1000-8000-00805f9b34fb"] }],
        optionalServices: ["0000ffe0-0000-1000-8000-00805f9b34fb"],
      });
      if (!device) return;

      const server = await device.gatt.connect();
      setBluetoothDevice(device);
      setBluetoothServer(server);
      setConnectionStatus(true);
      console.log("Reconnected to remembered device:", device.name);
    } catch (error) {
      console.warn("Auto-reconnect failed:", error);
    }
  }

  // ----------------- Player Management -----------------
  const addPlayer = () => {
    if (!name || !color) {
      let message = "Please fill out the following fields:\n";
      if (!name) message += "- Player Name\n";
      if (!color) message += "- Color\n";
      setDialogMessage(message);
      setDialogOpen(true);
      return;
    }
    setPlayers((prev) => [
      ...prev,
      { id: Date.now(), name, color, turnOrder: prev.length + 1 },
    ]);
    setName("");
    setColor("");
  };

  const removePlayer = (id) => {
    const updatedPlayers = players.filter((p) => p.id !== id);
    setPlayers(
      updatedPlayers.map((p, idx) => ({ ...p, turnOrder: idx + 1 }))
    );
  };

  // **Flip** the logic: pressing Up arrow moves the player up in the array
  // (i.e. index > 0 => swap with index - 1).
  const movePlayerUp = (index) => {
    if (index > 0) {
      const updated = [...players];
      [updated[index], updated[index - 1]] = [
        updated[index - 1],
        updated[index],
      ];
      setPlayers(
        updated.map((p, idx) => ({ ...p, turnOrder: idx + 1 }))
      );
    }
  };

  // Pressing Down arrow moves the player down in the array
  // (i.e. index < players.length - 1 => swap with index + 1).
  const movePlayerDown = (index) => {
    if (index < players.length - 1) {
      const updated = [...players];
      [updated[index], updated[index + 1]] = [
        updated[index + 1],
        updated[index],
      ];
      setPlayers(
        updated.map((p, idx) => ({ ...p, turnOrder: idx + 1 }))
      );
    }
  };

  // ----------------- Bluetooth -----------------
  const selectBluetoothDevice = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["0000ffe0-0000-1000-8000-00805f9b34fb"],
      });
      console.log("Selected device:", device.name);

      const server = await device.gatt.connect();
      console.log("GATT connected to:", device.name);

      // Store device ID for potential reconnection
      localStorage.setItem(LOCAL_STORAGE_DEVICE_ID_KEY, device.id);

      setBluetoothDevice(device);
      setBluetoothServer(server);
      setConnectionStatus(true);
    } catch (error) {
      console.error("Bluetooth device selection failed:", error);
      setDialogMessage("Failed to select a Bluetooth device. Please try again.");
      setDialogOpen(true);
    }
  };

  const sendPlayersToESP32 = async () => {
    if (!bluetoothDevice) {
      setDialogMessage("Please connect to a button first.");
      setDialogOpen(true);
      return;
    }

    setSendingStatus("sending");
    const data = JSON.stringify(players);

    try {
      let server = bluetoothServer;
      if (!server || !bluetoothDevice.gatt.connected) {
        console.log("Server was disconnected or missing, reconnecting...");
        server = await bluetoothDevice.gatt.connect();
        setBluetoothServer(server);
      }

      const service = await server.getPrimaryService("0000ffe0-0000-1000-8000-00805f9b34fb");
      const characteristic = await service.getCharacteristic("0000ffe1-0000-1000-8000-00805f9b34fb");
      await characteristic.writeValue(new TextEncoder().encode(data));
      console.log("Wrote player list to ESP32:", data);

      setSendingStatus("success");
    } catch (error) {
      console.error("Error sending data to ESP32:", error);
      setSendingStatus("error");
      setDialogMessage("Failed to send data to ESP32. Please try again.");
      setDialogOpen(true);
    }
  };

  // ----------------- Render -----------------
  return (
    <div className="App">
      <AppBar position="static" style={{ backgroundColor: "#333", color: "#fff" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Slicks Wonder Button Config
          </Typography>
        </Toolbar>
      </AppBar>

      <div style={{ padding: "20px" }}>
        {/* Add Player Form */}
        <Grid container spacing={2} justifyContent="center">
          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Add a New Player</Typography>
                <TextField
                  label="Player Name"
                  fullWidth
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ marginBottom: "10px" }}
                />
                <FormControl fullWidth>
                  <InputLabel>Color</InputLabel>
                  <Select
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    renderValue={(selected) => (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            backgroundColor: selected,
                            borderRadius: "50%",
                          }}
                        ></div>
                        {colors.find((c) => c.value === selected)?.label}
                      </div>
                    )}
                  >
                    {colors.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              backgroundColor: option.value,
                              borderRadius: "50%",
                            }}
                          ></div>
                          {option.label}
                        </div>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </CardContent>
              <CardActions>
                <Button
                  variant="contained"
                  onClick={addPlayer}
                  fullWidth
                  style={{ padding: "10px", backgroundColor: "#333", color: "#fff" }}
                >
                  Add Player
                </Button>
              </CardActions>
            </Card>
          </Grid>
        </Grid>

        {/* Show Existing Players */}
        <Grid container spacing={3} style={{ marginTop: "20px" }}>
          {players.map((player, index) => {
            // Determine card text/icon color:
            // If color is #16A085 (Teal) or #FFFFFF (White), text is black
            const isTeal = player.color === "#00FFFF";
            const isWhite = player.color === "#FFFFFF";
            const textColor = isTeal || isWhite ? "#000" : "#fff";

            return (
              <Grid item xs={12} sm={6} md={4} key={player.id}>
                <Card style={{ backgroundColor: player.color, color: textColor }}>
                  <CardContent>
                    <Typography variant="h5" style={{ color: textColor }}>
                      {player.name}
                    </Typography>
                    <Typography variant="body1" style={{ color: textColor }}>
                      Turn Order: {player.turnOrder}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <IconButton
                      onClick={() => movePlayerUp(index)}
                      style={{ color: textColor }}
                    >
                      <ArrowUpwardIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => movePlayerDown(index)}
                      style={{ color: textColor }}
                    >
                      <ArrowDownwardIcon />
                    </IconButton>
                    <Button
                      style={{ color: textColor }}
                      onClick={() => removePlayer(player.id)}
                    >
                      Remove
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Bluetooth Connect and Send Buttons */}
        <Grid container spacing={2} justifyContent="center" style={{ marginTop: "20px" }}>
          <Grid item>
            <Button
              variant="contained"
              onClick={selectBluetoothDevice}
              style={{ backgroundColor: "#007bff", color: "#fff", marginBottom: "10px" }}
            >
              {connectionStatus ? (
                <>
                  <CheckCircleIcon style={{ marginRight: "5px", color: "green" }} />
                  Connected
                </>
              ) : (
                "Connect to Button"
              )}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              onClick={sendPlayersToESP32}
              style={{ backgroundColor: "#28a745", color: "#fff", marginBottom: "10px" }}
            >
              Send Player List
            </Button>
          </Grid>
        </Grid>

        {/* Sending Status */}
        <Grid container justifyContent="center" style={{ marginTop: "10px" }}>
          <Typography variant="body1">
            Status:{" "}
            {sendingStatus === "sending" ? (
              <>
                <CircularProgress size={20} style={{ marginRight: "5px" }} />
                Sending...
              </>
            ) : sendingStatus === "success" ? (
              <>
                <CheckCircleIcon style={{ marginRight: "5px", color: "green" }} />
                Sent Successfully
              </>
            ) : sendingStatus === "error" ? (
              <>
                <CancelIcon style={{ marginRight: "5px", color: "red" }} />
                Error
              </>
            ) : (
              <>
                <CancelIcon style={{ marginRight: "5px", color: "gray" }} />
                Idle
              </>
            )}
          </Typography>
        </Grid>
      </div>

      {/* Error Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Typography>{dialogMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default App;
