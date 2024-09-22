import { AbstractPage } from "../../common/classes/page.js";
import onChange from 'on-change';
import { Header } from "../../components/header/header.js";
import { Search } from "../../components/search/search.js";
import { CardList } from "../../components/card-list/card-list.js";
import { Pagination } from "../../components/pagination/pagination.js";
// import Swiper from 'swiper'; 

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
        page: 1,
        limit: 12
    }

    appStateHook(path) {
       if(path === "favorites" || path ==="searchBookId" ) {
        this.render()
       }


    
    }


    async stateHook(path) {
        if(path === "searchValue" || path === "page") {

            this.state.isLoading = true
            const data = await this.getBookList(this.state.searchValue, this.state.page, this.state.limit)
            this.state.bookList = data.docs
            this.state.numFound = data.numFound
            this.state.isLoading = false

        }

        switch(path) {
            case "bookList": this.render()
            break;

            case "numFound": this.render()
            break;

            case "isLoading": this.render()
            break;

            default: break;
        }

        // if(path === "bookList" || path === "numFound" || path === "isLoading") {
        //     this.render()
        // }
    }


async getBookList(searchValue, page, limit) {
    const getData = await fetch(`https://openlibrary.org/search.json?q=${searchValue}&page=${page}&limit=${limit}`)
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
        const paginationComponent = new Pagination(this.state)
        main.append(searchComponent)
        main.append(cardlist)
        if(this.state.bookList.length) {
            main.append(paginationComponent.render())
        }
        this.app.innerHTML = ""
        this.app.append(main)
        this.renderHeader()

    }

    renderHeader() {
        const header = new Header(this.appState).render()
        this.app.prepend(header)
    }
}