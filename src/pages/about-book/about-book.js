import { AbstractPage } from "../../common/classes/page.js";
import onChange from 'on-change';
import { Header } from "../../components/header/header.js";


export class AboutBookPage extends AbstractPage {
    state = {
        book: null,
        isLoading: false
    }
    constructor(appState) {
        super()
        this.setTitle("Информация о книги")
        this.appState = appState
        this.appState = onChange(this.appState, this.appStateHook.bind(this))
        this.state = onChange(this.state, this.stateHook.bind(this))
        this.#setBookData()
        
    }

    stateHook(path) {
        if(path === "isLoading" || path === "book"){
            this.render()
        }
    }

  

    appStateHook(path) {
       if(path === "favorites" || path ==="searchBookId") {
        this.render()
       }


    
    }


    async #setBookData() {
        try {
            this.state.isLoading = true
            const book = await this.#loadBook()
            this.state.book = book
            this.state.isLoading = false
        } catch (e) {
            this.errorHandler(e)
        }
    }

    async #loadBook () {
        try {
            const data = await fetch(`https://openlibrary.org/books/${this.appState.searchBookId}.json`)
            return data.json()
        } catch(e) {
            this.errorHandler(e)
        }

    }


    unmount() {
        onChange.unsubscribe(this.appState)
        onChange.unsubscribe(this.state)
    }

    render() {
        const main = document.createElement("div")
        main.innerHTML = `
        <h1> ${this.state.isLoading ? "Загрузка..." : this.state.book.title} </h1>

       
        `
        this.app.innerHTML = ""
        this.app.append(main)
        this.renderHeader()

    }

    renderHeader() {
        const header = new Header(this.appState).render()
        this.app.prepend(header)
    }
}