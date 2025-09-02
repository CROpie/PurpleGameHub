/* Login Page */
async function handleGetToken(event) {

    event.preventDefault()

    const message = document.getElementById("message")

    const form = event.target
    const formData = new FormData(form)

    try {
        const response = await fetch("http://localhost:8000/api/token", {
                method: "POST",
                body: formData
        })

        let json;
        try {
            json = await response.json()
        } catch {
            json = null
            // data might be empty or not json
        }

        if (!response.ok) {
            message.textContent = json?.error ?? 'Something went wrong...'
            return
        }

        if (!json?.data) {
            message.textContent = "Response did not contain data object"
            return
        }

        message.textContent = "token retrieved successfully"

        setCookie("token", json.data)

        await init()

    } catch (error) {
        console.error("Network error: request failed")
    }
}

function setCookie(name, value, days=1) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function renderLogIn() {
    const template = `
    <section id="formSection">
        <form id="loginForm">
            <input name="username" id="username" type="text">
            <label for="username">Username</label>
            <input name="password" id="password" type="password">
            <label for="password">Password</label>
            <button type="submit">Submit</button>
        </form>
        <p id="message"></p>
    </section>
    `

    const main = document.getElementById("main")
    main.innerHTML = template

    const form = document.getElementById("loginForm")

    form.addEventListener("submit", handleGetToken)
}

/* Hub page */
function renderHub(username) {

    const template = `
    <section id="hubSection">
        <h3>Welcome to the hub ${username}</h3>
        <a href="http://localhost:4000">Hangman</a>
    </section>
    `

    const main = document.getElementById("main")
    main.innerHTML = template
}

/* Admin Page */

function parseResponse(event) {
    if (typeof event != "string") throw new Error(`Event was not a string: ${event}`)

    try {
        return JSON.parse(event)
    } catch (error) {
        throw new Error(`Input event could not be parsed: ${error.message}`)
    }
}

function renderTable(data, table) {

    // extract keys
    if (!data.length) return
    const keys = Object.keys(data[0])

    const tHead = document.createElement('thead')
    for (const key of keys) {
        const th = document.createElement('th')
        th.textContent = key
        tHead.appendChild(th)
    }
    const tBody = document.createElement('tbody')
    for (const row of data) {
        const tr = document.createElement('tr')
        const values = Object.values(row)
        for (const value of values) {
            const td = document.createElement('td')
            td.innerHTML = value
            tr.appendChild(td)
        }
        tBody.appendChild(tr)
    }
    table.appendChild(tHead)
    table.appendChild(tBody)
}

async function startSocket() {

    const ws = new WebSocket("ws://127.0.0.1:9047")
    const message = document.getElementById("message")
    const table = document.getElementById("table")



    ws.onopen = () => {
        console.log("Connected to DB proxy successfully")
    }

    ws.onmessage = (event) => {

        message.textContent = ''
        table.innerHTML = ''

        const response = parseResponse(event.data)

        // Array: query was SELECT
        // Object: query was not SELECT
        if (Array.isArray(response)) {
            renderTable(response, table)
        } else {
            message.textContent = response?.data ? response.data : "unknown response"
        }
        console.log(response)
    }

    document.getElementById("sendBtn").addEventListener("click", (event) => {
        const SQL = document.getElementById("sqlInput").value;
        ws.send(SQL);
    })
}

async function renderAdmin() {
    const template = `
    <section id="adminSection">
        <h3>Database Connection</h3>
        <input type="text" id="sqlInput" />
        <button id="sendBtn" type="button">Execute</button>
        <p id="message"></p>
        <table id="table"></table>
    </section>
    `

    const main = document.getElementById("main")
    main.innerHTML = template

    await startSocket()

}

/* Directing Function */
function getCookie(name) {
    const matches = document.cookie.match(new RegExp(
        `(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1')}=([^;]*)`
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

/* api/authenticate returns parsed user data */
async function ifTokenValidSetUserdata(token) {

    console.log(token)

    try {
        const response = await fetch("http://localhost:8000/api/authenticate", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
        })

        let json;
        try {
            json = await response.json()
        } catch {
            json = null
        }

        if (!response.ok) {
            console.error(json?.error ?? "something went wrong...")
            return false
        }

        if (!json?.data) {
            message.textContent = "Response did not contain data object"
            return false
        }

        setCookie('userdata', JSON.stringify(json.data))

        return true

    } catch (error) {
        console.error("Network error: request failed", error.message)
        return false
    }

}

async function init() {

    document.getElementById('logout').addEventListener('click', () => {
        setCookie('token', 'delete', 0)
        renderLogIn()
    })

    const token = getCookie('token')

    if (!token || !await ifTokenValidSetUserdata(token)) {
        renderLogIn()
        return
    }

    const userdata = getCookie('userdata')

    const username = JSON.parse(userdata).username


    if (username == 'admin') {
        await renderAdmin()
    } else {
        renderHub(username)
    }
}

onload = init