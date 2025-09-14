import type { Config, UserData } from "./types";

/* Helpers */

function setCookie(name: string, value: string, days=1) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function assignEle<T extends HTMLElement>(elementId: string): T {
    const element = document.getElementById(elementId)
    if (!element) throw new Error(`no element with id ${elementId}`)
    return element as T
}

async function loadConfig(): Promise<Config> {
    const response = await fetch("dist/config.json");
    return response.json();
}

/* Pages */

function LogInPage() {

    let main: HTMLElement
    let form: HTMLFormElement
    let message: HTMLParagraphElement

    let authBaseUrl = ''

    function open({AUTH_BASE_URL}: {AUTH_BASE_URL: string}) {
        authBaseUrl = AUTH_BASE_URL

        const mainEl = document.getElementById("main")
        if (!(mainEl instanceof HTMLElement)) throw new Error("no main element")
        main = mainEl

        render()

        const formEl = document.getElementById("loginForm")
        if (!(formEl instanceof HTMLFormElement)) throw new Error("no form element")
        form = formEl

        const messageEl = document.getElementById("message")
        if (!(messageEl instanceof HTMLParagraphElement)) throw new Error("no message element")
            message = messageEl

        form.addEventListener("submit", handleGetToken)
    }

    function render() {
        const template = `
        <article id="login-page">
            <section id="formSection">
                <form id="loginForm">
                    <label for="username">Username</label>
                    <input name="username" id="username" type="text">
                    <label for="password">Password</label>
                    <input name="password" id="password" type="password">
                    <button type="submit">Submit</button>
                </form>
                <p id="message"></p>
            </section>
        </article>
        `
        main.innerHTML = template
    }

    async function handleGetToken(event: SubmitEvent) {

        event.preventDefault()
    
        const formData = new FormData(form)
    
        try {
            const response = await fetch(`${authBaseUrl}/api/token`, {
                    method: "POST",
                    body: formData,
                    credentials: 'include'
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

            await init()
    
        } catch (error) {
            console.error("Network error: request failed")
        }
    }

    return { open }
}

function AdminPage() {

    let ws: WebSocket

    let main: HTMLElement
    let table: HTMLTableElement
    let sendBtn: HTMLButtonElement
    let message: HTMLParagraphElement
    let sqlInput: HTMLInputElement

    let databaseProxyUrl: string
 
    function open({DATABASE_PROXY_URL}: {DATABASE_PROXY_URL: string}) {

        databaseProxyUrl = DATABASE_PROXY_URL

        main = assignEle<HTMLElement>("main")

        render()

        table = assignEle<HTMLTableElement>("table")
        sendBtn = assignEle<HTMLButtonElement>("sendBtn")
        message = assignEle<HTMLParagraphElement>("message")
        sqlInput = assignEle<HTMLInputElement>("sqlInput")

        startSocket()
    }

    function render() {
        const template = `
        <article id="admin-page">
            <section id="adminSection">
                <h3>Database Connection</h3>
                <input type="text" id="sqlInput" />
                <button id="sendBtn" type="button">Execute</button>
                <p id="message"></p>
                <table id="table"></table>
            </section>
        </article>
        `
        
        main.innerHTML = template
    }

    function parseResponse(data: any) {
        if (typeof data != "string") throw new Error(`Event was not a string: ${data}`)
    
        try {
            return JSON.parse(data)
        } catch (error: any) {
            throw new Error(`Input event could not be parsed: ${error.message}`)
        }
    }

    function startSocket() {

        ws = new WebSocket(databaseProxyUrl)

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
                renderTable(response)
            } else {
                message.textContent = response?.data ? response.data : "unknown response"
            }
        }
    
        sendBtn.addEventListener("click", () => {
            ws.send(sqlInput.value);
        })
    }

    function renderTable(data: any) {

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
                td.textContent = value !== null && value !== undefined ? String(value) : ''
                tr.appendChild(td)
            }
            tBody.appendChild(tr)
        }
        table.appendChild(tHead)
        table.appendChild(tBody)
    }

    return { open }

}

function HubPage() {

    let main: HTMLElement
    let userData: UserData
    let hangmanUrl: string

    function open({userD, hangmanU}: {userD: UserData, hangmanU: string}) {

        userData = userD
        hangmanUrl = hangmanU

        const mainEl = document.getElementById("main")
        if (!(mainEl instanceof HTMLElement)) throw new Error("no main element")
        main = mainEl

        render()

    }

    function render() {
        const template = `
        <section id="hubSection">
            <h3>Welcome to the hub ${userData.username}</h3>
            <a href="${hangmanUrl}">Hangman</a>
        </section>
        `
        main.innerHTML = template
    }

    return { open }
}

/* Services */

function AuthService() {

    let authBaseUrl = ''
    let userData: UserData

    let logoutButton: HTMLButtonElement

    function init({AUTH_BASE_URL}: {AUTH_BASE_URL: string}) {

        authBaseUrl = AUTH_BASE_URL

        const logoutButtonEl = document.getElementById("logoutBtn")
        if (!(logoutButtonEl instanceof HTMLButtonElement)) throw new Error("no logout button")
        logoutButton = logoutButtonEl

        logoutButton.addEventListener('click', () => {
            handleLogOut()
        })
    }

    async function validateToken(): Promise<boolean> {
        try {

            const response = await fetch(`${authBaseUrl}/api/authenticate`, {
                    method: "GET",
                    credentials: 'include'
                })

            let json

            // just handing the situation where data might be empty or not json
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
                console.error("Response did not contain data object")
                return false
            }

            userData = json.data

            return true
    
        } catch (error) {
            console.error("Network error: request failed")
            return false
        }
    }

    function getUserData() {
        return userData
    }

    async function handleLogOut() {

        await fetch(`${authBaseUrl}/api/logout`, {
            method: "GET",
            credentials: 'include'
        })

        window.location.reload()
    }

    return { init, validateToken, getUserData }
}

async function init() {

    const config = await loadConfig()

    const authService = AuthService()

    const loginPage = LogInPage()
    const adminPage = AdminPage()
    const hubPage = HubPage()

    authService.init({AUTH_BASE_URL: config.AUTH_BASE_URL})

    if (!await authService.validateToken()){
        loginPage.open({AUTH_BASE_URL: config.AUTH_BASE_URL})
        return
    }

    const userData = authService.getUserData()

    if (userData.username === 'admin') {
        adminPage.open({DATABASE_PROXY_URL: config.DATABASE_PROXY_URL})
        return
    }

    hubPage.open({userD: userData, hangmanU: config.HANGMAN_URL})
}

onload = init