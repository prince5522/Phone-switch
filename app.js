// ==========================================
// SMART SWITCH v1.8
// UNIVERSAL ESP8266 CONTROL APP
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
// CLEAN ESP ADDRESS
// ------------------------------------------

function cleanESPAddress(value) {

    let address = value.trim();

    // Remove spaces
    address = address.replace(/\s+/g, "");

    // If user entered a protocol, keep it.
    // Otherwise use HTTP.
    if (
        !address.startsWith("http://") &&
        !address.startsWith("https://")
    ) {

        address = "http://" + address;

    }

    // Remove trailing slash
    address = address.replace(/\/+$/, "");

    return address;

}


// ------------------------------------------
// VALIDATE ESP ADDRESS
// ------------------------------------------

function isValidESPAddress(value) {

    if (!value || !value.trim()) {
        return false;
    }

    let address = value.trim();

    // Remove protocol
    address = address.replace(
        /^https?:\/\//i,
        ""
    );

    // Remove path
    address = address.split("/")[0];

    // --------------------------------------
    // IPv4 with optional port
    // --------------------------------------

    const ipv4Pattern =
        /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

    if (ipv4Pattern.test(address)) {

        const host =
            address.split(":")[0];

        const parts =
            host.split(".");

        const validIP =
            parts.length === 4 &&
            parts.every((part) => {

                const number =
                    Number(part);

                return (
                    /^\d+$/.test(part) &&
                    number >= 0 &&
                    number <= 255
                );

            });

        if (!validIP) {
            return false;
        }

        // Check port if supplied
        if (address.includes(":")) {

            const port =
                Number(
                    address.split(":")[1]
                );

            if (
                port < 1 ||
                port > 65535
            ) {
                return false;
            }

        }

        return true;

    }


    // --------------------------------------
    // IPv6
    // --------------------------------------

    if (
        address.includes(":") &&
        /^[0-9a-fA-F:]+$/.test(address)
    ) {

        return true;

    }


    // --------------------------------------
    // Hostname
    // --------------------------------------

    const hostnamePattern =
        /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

    if (
        hostnamePattern.test(address)
    ) {

        return true;

    }


    return false;

}


// ------------------------------------------
// MESSAGE
// ------------------------------------------

function showMessage(
    text,
    error = false
) {

    if (!message) {
        return;
    }

    message.textContent = text;

    if (error) {

        message.classList.add(
            "error"
        );

    } else {

        message.classList.remove(
            "error"
        );

    }

}


// ------------------------------------------
// ONLINE / OFFLINE
// ------------------------------------------

function setOnline(online) {

    if (online) {

        connectionDot.classList.add(
            "online"
        );

        connectionDot.classList.remove(
            "offline"
        );

        deviceOnline.textContent =
            "Online";

        deviceOnline.classList.add(
            "online-badge"
        );

        deviceOnline.classList.remove(
            "offline-badge"
        );

    } else {

        connectionDot.classList.remove(
            "online"
        );

        connectionDot.classList.add(
            "offline"
        );

        deviceOnline.textContent =
            "Offline";

        deviceOnline.classList.remove(
            "online-badge"
        );

        deviceOnline.classList.add(
            "offline-badge"
        );

    }

}


// ------------------------------------------
// SHOW / HIDE DEVICE CARDS
// ------------------------------------------

function showDeviceCards(show) {

    if (show) {

        deviceCard.classList.remove(
            "hidden"
        );

        switchCard.classList.remove(
            "hidden"
        );

        infoCard.classList.remove(
            "hidden"
        );

    } else {

        deviceCard.classList.add(
            "hidden"
        );

        switchCard.classList.add(
            "hidden"
        );

        infoCard.classList.add(
            "hidden"
        );

    }

}


// ------------------------------------------
// REQUEST ESP8266
// ------------------------------------------

async function request(path) {

    if (!espAddress) {

        throw new Error(
            "ESP8266 address is not set."
        );

    }


    const url =
        espAddress + path;


    console.log(
        "SMART SWITCH →",
        url
    );


    const controller =
        new AbortController();


    const timeout =
        setTimeout(() => {

            controller.abort();

        }, 5000);


    try {

        const response =
            await fetch(
                url,
                {
                    method: "GET",

                    mode: "cors",

                    cache: "no-store",

                    signal: controller.signal,

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                "ESP8266 returned HTTP " +
                response.status
            );

        }


        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            contentType.includes(
                "application/json"
            )
        ) {

            return await response.json();

        }


        const text =
            await response.text();


        try {

            return JSON.parse(text);

        } catch {

            return {
                response: text
            };

        }

    } catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "ESP8266 connection timed out."
            );

        }


        if (
            window.location.protocol ===
                "https:" &&
            url.startsWith("http://")
        ) {

            throw new Error(
                "HTTPS cannot directly access an HTTP ESP8266. Run the app locally over HTTP or use an HTTPS backend."
            );

        }


        throw error;

    } finally {

        clearTimeout(timeout);

    }

}


// ------------------------------------------
// CONNECT DEVICE
// ------------------------------------------

async function connectDevice() {

    const enteredAddress =
        espIp.value.trim();


    // --------------------------------------
    // VALIDATE
    // --------------------------------------

    if (
        !isValidESPAddress(
            enteredAddress
        )
    ) {

        showMessage(
            "Enter a valid ESP8266 IP address, for example 192.168.1.100.",
            true
        );

        return;

    }


    // --------------------------------------
    // CREATE ADDRESS
    // --------------------------------------

    espAddress =
        cleanESPAddress(
            enteredAddress
        );


    console.log(
        "ESP8266 ADDRESS:",
        espAddress
    );


    // --------------------------------------
    // HTTPS WARNING
    // --------------------------------------

    if (
        window.location.protocol ===
            "https:" &&
        espAddress.startsWith("http://")
    ) {

        setOnline(false);

        showMessage(
            "The ESP8266 address is accepted, but this HTTPS page cannot directly connect to its HTTP server. Use the app locally over HTTP or an HTTPS backend.",
            true
        );

        return;

    }


    // --------------------------------------
    // CONNECTING
    // --------------------------------------

    connectButton.disabled = true;

    connectButton.textContent =
        "CONNECTING...";


    showMessage(
        "Connecting to ESP8266..."
    );


    try {

        const data =
            await request(
                "/status"
            );


        // ----------------------------------
        // SAVE ADDRESS
        // ----------------------------------

        localStorage.setItem(
            "smartSwitchESP",
            enteredAddress
        );


        // ----------------------------------
        // SHOW DEVICE
        // ----------------------------------

        setupCard.classList.add(
            "hidden"
        );

        showDeviceCards(true);

        setOnline(true);


        // ----------------------------------
        // DISPLAY IP
        // ----------------------------------

        $("deviceIp").textContent =
            enteredAddress;

        $("infoDeviceIp").textContent =
            enteredAddress;


        // ----------------------------------
        // DEVICE NAME
        // ----------------------------------

        if (data.device) {

            $("deviceName").textContent =
                data.device;

            $("infoDeviceName").textContent =
                data.device;

        }


        if (data.name) {

            $("deviceName").textContent =
                data.name;

            $("infoDeviceName").textContent =
                data.name;

        }


        // ----------------------------------
        // DEVICE ID
        // ----------------------------------

        if (data.id) {

            $("deviceId").textContent =
                data.id;

        }


        if (data.deviceId) {

            $("deviceId").textContent =
                data.deviceId;

        }


        // ----------------------------------
        // POWER STATE
        // ----------------------------------

        updateState(data);


        // ----------------------------------
        // DEVICE INFORMATION
        // ----------------------------------

        await loadInfo();


        showMessage("");


        // ----------------------------------
        // START POLLING
        // ----------------------------------

        startPolling();

    } catch (error) {

        console.error(
            "Connection error:",
            error
        );


        setOnline(false);

        showDeviceCards(false);


        showMessage(
            error.message ||
            "Could not connect to the ESP8266. Check the address and make sure the ESP is online.",
            true
        );

    }


    connectButton.disabled = false;

    connectButton.textContent =
        "CONNECT";

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


    state =
        String(state).toUpperCase();


    const isOn =
        state === "ON" ||
        state === "1" ||
        state === "TRUE";


    if (isOn) {

        switchState.textContent =
            "ON";

    } else {

        switchState.textContent =
            "OFF";

    }

}


// ------------------------------------------
// LOAD DEVICE INFORMATION
// ------------------------------------------

async function loadInfo() {

    try {

        const data =
            await request(
                "/info"
            );


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


        if (
            data.signal !== undefined
        ) {

            $("wifiSignal").textContent =
                data.signal + " dBm";

        }

    } catch (error) {

        console.log(
            "Device information unavailable:",
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

        showMessage(
            "Connect to the ESP8266 first.",
            true
        );

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
            await request(
                "/status"
            );


        setOnline(true);

        updateState(data);

    } catch (error) {

        console.log(
            "ESP status check failed:",
            error
        );

        setOnline(false);

    }

}


// ------------------------------------------
// START POLLING
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
// ENTER KEY
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
// LOAD SAVED ESP ADDRESS
// ------------------------------------------

window.addEventListener(
    "load",
    () => {

        const savedAddress =
            localStorage.getItem(
                "smartSwitchESP"
            );


        if (
            savedAddress &&
            isValidESPAddress(
                savedAddress
            )
        ) {

            espIp.value =
                savedAddress;

        }

    }
);
