import { AbstractPage } from "../../common/classes/page.js";
import onChange from 'on-change';
import { Header } from "../../components/header/header.js";
import { Search } from "../../components/search/search.js";
import { CardList } from "../../components/card-list/card-list.js";

export class MainPage extends AbstractPage {
    constructor(appState) {
        super()
        this.setTitle("Главная страница")
        this.appState = appState
        this.appState = onChange(this.appState, this.appStateHook.bind(this))
        this.state = onChange(this.state, this.stateHook.bind(this))
    }

    state = {
        bookList: [],
        numFound: 0,
        isLoading: false,
        searchValue: "",
        offset: null
    }

    appStateHook(path) {
       if(path === "favorites") {
        this.render()
       }


    
    }


    async stateHook(path) {
        if(path === "searchValue") {

            this.state.isLoading = true
            const data = await this.getBookList(this.state.searchValue, this.state.offset)
            this.state.bookList = data.docs
            this.state.numFound = data.numFound
            this.state.isLoading = false

        }
        if(path === "bookList" || path === "numFound" || path === "isLoading") {
            this.render()
        }
    }


async getBookList(searchValue, offset) {
    const getData = await fetch(`https://openlibrary.org/search.json?q=${searchValue}&offset=${offset}`)
    return getData.json()
}

    render() {
        const main = document.createElement("div")
        main.innerHTML = `
        <h1> Найдено книг - ${this.state.numFound}   </h1>
       
        `
        main.innerHTML = ``
        const searchComponent = new Search(this.state).render()
        const cardlist = new CardList(this.appState, this.state).render()
        main.append(searchComponent)
        main.append(cardlist)

        this.app.innerHTML = ""
        this.app.append(main)
        this.renderHeader()

    }

    renderHeader() {
        const header = new Header(this.appState).render()
        this.app.prepend(header)
    }
}