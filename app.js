// ==========================================
// SMART SWITCH v1.8
// ESP8266 CONTROL APP
// ==========================================

const $ = (id) => document.getElementById(id);


// ------------------------------------------
// ELEMENTS
// ------------------------------------------

const setupCard = $("setupCard");
const deviceCard = $("deviceCard");
const switchCard = $("switchCard");
const infoCard = $("infoCard");

const espIp = $("espIp");
const connectButton = $("connectButton");
const changeIpButton = $("changeIpButton");

const onButton = $("onButton");
const offButton = $("offButton");

const message = $("message");
const connectionDot = $("connectionDot");

const deviceOnline = $("deviceOnline");
const switchState = $("switchState");

let espAddress = "";
let pollTimer = null;


// ------------------------------------------
// VALIDATE IPv4 ADDRESS
// ------------------------------------------

function isValidIPv4(ip) {

    const parts = ip.trim().split(".");

    if (parts.length !== 4) {
        return false;
    }

    return parts.every((part) => {

        if (!/^\d+$/.test(part)) {
            return false;
        }

        const number = Number(part);

        return number >= 0 && number <= 255;

    });

}


// ------------------------------------------
// MESSAGE
// ------------------------------------------

function showMessage(text, error = false) {

    message.textContent = text;

    if (error) {
        message.classList.add("error");
    } else {
        message.classList.remove("error");
    }

}


// ------------------------------------------
// ONLINE / OFFLINE STATUS
// ------------------------------------------

function setOnline(online) {

    if (online) {

        connectionDot.classList.add("online");
        connectionDot.classList.remove("offline");

        deviceOnline.textContent = "Online";

        deviceOnline.classList.add("online-badge");
        deviceOnline.classList.remove("offline-badge");

    } else {

        connectionDot.classList.remove("online");
        connectionDot.classList.add("offline");

        deviceOnline.textContent = "Offline";

        deviceOnline.classList.remove("online-badge");
        deviceOnline.classList.add("offline-badge");

    }

}


// ------------------------------------------
// SHOW / HIDE DEVICE CARDS
// ------------------------------------------

function showDeviceCards(show) {

    if (show) {

        deviceCard.classList.remove("hidden");
        switchCard.classList.remove("hidden");
        infoCard.classList.remove("hidden");

    } else {

        deviceCard.classList.add("hidden");
        switchCard.classList.add("hidden");
        infoCard.classList.add("hidden");

    }

}


// ------------------------------------------
// REQUEST ESP8266
// ------------------------------------------

async function request(path) {

    if (!espAddress) {

        throw new Error("ESP address not set");

    }


    const controller = new AbortController();

    const timeout = setTimeout(() => {

        controller.abort();

    }, 5000);


    try {

        const response = await fetch(
            espAddress + path,
            {
                method: "GET",
                cache: "no-store",
                signal: controller.signal
            }
        );


        if (!response.ok) {

            throw new Error(
                "HTTP " + response.status
            );

        }


        return await response.json();

    } finally {

        clearTimeout(timeout);

    }

}


// ------------------------------------------
// CONNECT DEVICE
// ------------------------------------------

async function connectDevice() {

    const ip = espIp.value.trim();


    if (!isValidIPv4(ip)) {

        showMessage(
            "Enter a valid IPv4 address, for example 192.168.137.123.",
            true
        );

        return;

    }


    espAddress = "http://" + ip;


    connectButton.disabled = true;

    connectButton.textContent = "CONNECTING...";


    showMessage(
        "Connecting to ESP8266..."
    );


    try {

        const data = await request(
            "/status"
        );


        // Save IP
        localStorage.setItem(
            "smartSwitchESP",
            ip
        );


        // Show interface
        setupCard.classList.add("hidden");

        showDeviceCards(true);

        setOnline(true);


        // IP
        $("deviceIp").textContent = ip;

        $("infoDeviceIp").textContent = ip;


        // Device name
        if (data.device) {

            $("deviceName").textContent =
                data.device;

            $("infoDeviceName").textContent =
                data.device;

        }


        // Device ID
        if (data.id) {

            $("deviceId").textContent =
                data.id;

        }


        if (data.deviceId) {

            $("deviceId").textContent =
                data.deviceId;

        }


        // Power state
        updateState(data);


        // Additional information
        await loadInfo();


        showMessage("");


        startPolling();


    } catch (error) {

        console.error(
            "Connection error:",
            error
        );


        setOnline(false);

        showDeviceCards(false);


        showMessage(
            "Could not connect to the ESP8266. Check the IP address and make sure the ESP is online.",
            true
        );

    }


    connectButton.disabled = false;

    connectButton.textContent = "CONNECT";

}


// ------------------------------------------
// UPDATE POWER STATE
// ------------------------------------------

function updateState(data) {

    let state =
        data.state ??
        data.status ??
        data.power ??
        "OFF";


    state = String(state).toUpperCase();


    const isOn =
        state === "ON" ||
        state === "1" ||
        state === "TRUE";


    if (isOn) {

        switchState.textContent = "ON";

    } else {

        switchState.textContent = "OFF";

    }

}


// ------------------------------------------
// LOAD DEVICE INFORMATION
// ------------------------------------------

async function loadInfo() {

    try {

        const data =
            await request("/info");


        if (data.name) {

            $("deviceName").textContent =
                data.name;

            $("infoDeviceName").textContent =
                data.name;

        }


        if (data.device) {

            $("deviceName").textContent =
                data.device;

            $("infoDeviceName").textContent =
                data.device;

        }


        if (data.id) {

            $("deviceId").textContent =
                data.id;

        }


        if (data.deviceId) {

            $("deviceId").textContent =
                data.deviceId;

        }


        if (data.ip) {

            $("deviceIp").textContent =
                data.ip;

            $("infoDeviceIp").textContent =
                data.ip;

        }


        if (data.wifi) {

            $("wifiStatus").textContent =
                data.wifi;

        } else if (data.ssid) {

            $("wifiStatus").textContent =
                data.ssid;

        } else {

            $("wifiStatus").textContent =
                "Connected";

        }


        if (data.signal !== undefined) {

            $("wifiSignal").textContent =
                data.signal + " dBm";

        }

    } catch (error) {

        console.log(
            "Device info unavailable:",
            error
        );

    }

}


// ------------------------------------------
// SEND ON / OFF COMMAND
// ------------------------------------------

async function sendCommand(
    path,
    targetState
) {

    if (!espAddress) {

        return;

    }


    onButton.disabled = true;

    offButton.disabled = true;


    showMessage(
        "Sending command..."
    );


    try {

        await request(path);


        switchState.textContent =
            targetState;


        setOnline(true);


        showMessage(
            "Command sent successfully."
        );


    } catch (error) {

        console.error(
            "Command error:",
            error
        );


        setOnline(false);


        showMessage(
            "The ESP8266 did not respond.",
            true
        );

    }


    onButton.disabled = false;

    offButton.disabled = false;

}


// ------------------------------------------
// CHECK STATUS
// ------------------------------------------

async function pollStatus() {

    if (!espAddress) {

        return;

    }


    try {

        const data =
            await request("/status");


        setOnline(true);

        updateState(data);


    } catch (error) {

        setOnline(false);

    }

}


// ------------------------------------------
// START AUTOMATIC STATUS CHECK
// ------------------------------------------

function startPolling() {

    clearInterval(
        pollTimer
    );


    pollTimer =
        setInterval(
            pollStatus,
            5000
        );

}


// ------------------------------------------
// CHANGE DEVICE
// ------------------------------------------

function changeDevice() {

    clearInterval(
        pollTimer
    );


    localStorage.removeItem(
        "smartSwitchESP"
    );


    espAddress = "";


    showDeviceCards(false);


    setupCard.classList.remove(
        "hidden"
    );


    setOnline(false);


    showMessage("");


    espIp.value = "";


    espIp.focus();

}


// ------------------------------------------
// BUTTON EVENTS
// ------------------------------------------

connectButton.addEventListener(
    "click",
    connectDevice
);


changeIpButton.addEventListener(
    "click",
    changeDevice
);


onButton.addEventListener(
    "click",
    () => {

        sendCommand(
            "/on",
            "ON"
        );

    }
);


offButton.addEventListener(
    "click",
    () => {

        sendCommand(
            "/off",
            "OFF"
        );

    }
);


// ------------------------------------------
// ENTER KEY ON IP FIELD
// ------------------------------------------

espIp.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            connectDevice();

        }

    }
);


// ------------------------------------------
// LOAD SAVED IP
// ------------------------------------------

window.addEventListener(
    "load",
    () => {

        const savedIp =
            localStorage.getItem(
                "smartSwitchESP"
            );


        if (
            savedIp &&
            isValidIPv4(savedIp)
        ) {

            espIp.value =
                savedIp;

        }

    }
);