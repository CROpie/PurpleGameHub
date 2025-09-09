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

    let tokenUrl = ''

    function open({tokenU}: {tokenU: string}) {
        tokenUrl = tokenU

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
        main.innerHTML = template
    }

    async function handleGetToken(event: SubmitEvent) {

        event.preventDefault()
    
        const formData = new FormData(form)
    
        try {
            const response = await fetch(tokenUrl, {
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
 
    function open({databaseProxyU}: {databaseProxyU: string}) {

        databaseProxyUrl = databaseProxyU

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
        <section id="adminSection">
            <h3>Database Connection</h3>
            <input type="text" id="sqlInput" />
            <button id="sendBtn" type="button">Execute</button>
            <p id="message"></p>
            <table id="table"></table>
        </section>
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

    let token = ''

    let authenticationUrl = ''
    let userData: UserData

    let logoutButton: HTMLButtonElement
    
    function init({authUrl}: {authUrl: string}): boolean{

        const logoutButtonEl = document.getElementById("logoutBtn")
        if (!(logoutButtonEl instanceof HTMLButtonElement)) throw new Error("no logout button")
        logoutButton = logoutButtonEl

        logoutButton.addEventListener('click', () => {
            setCookie('token', 'delete', 0)
            window.location.reload()
        })


        authenticationUrl = authUrl
        token = getCookie('token')
        if (!token) {
            console.error("cookie key 'token' has no value")
            return false
        }
        return true
    }

    async function validateTokenExtractUserdata(): Promise<boolean> {
        try {

            const response = await fetch(authenticationUrl, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
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

            // used when changing page url
            setCookie("user", JSON.stringify(json.data))
    
            return true
    
        } catch (error) {
            console.error("Network error: request failed")
            return false
        }
    }

    function getUserData() {
        return userData
    }

    function getCookie(name: string): string {
        const matches = document.cookie.match(new RegExp(
            `(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1')}=([^;]*)`
        ));
        return matches ? decodeURIComponent(matches[1]!) : '';
    }

    return { init, validateTokenExtractUserdata, getUserData }
}

async function init() {

    const config = await loadConfig()

    const authService = AuthService()

    const loginPage = LogInPage()
    const adminPage = AdminPage()
    const hubPage = HubPage()

    if (!authService.init({ authUrl: config.AUTH_URL })) {
        loginPage.open({tokenU: config.TOKEN_URL})
        return
    }

    if (!await authService.validateTokenExtractUserdata()){
        loginPage.open({tokenU: config.TOKEN_URL})
        return
    }

    const userData = authService.getUserData()

    if (userData.username === 'admin') {
        adminPage.open({databaseProxyU: config.DATABASE_PROXY_URL})
        return
    }

    hubPage.open({userD: userData, hangmanU: config.HANGMAN_URL})
}

onload = init