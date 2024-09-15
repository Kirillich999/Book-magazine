import { AbstractPage } from "../../common/classes/page.js";
import onChange from 'on-change';
import { Header } from "../../components/header/header.js";
import { CardList } from "../../components/card-list/card-list.js";

export class FavoritePage extends AbstractPage {
    constructor(appState) {
        super()
        this.setTitle("Избранное")
        this.appState = appState
        this.appState = onChange(this.appState, this.appStateHook.bind(this))
        
    }

  

    appStateHook(path) {
       if(path === "favorites") {
        this.render()
       }


    
    }

    render() {
        const main = document.createElement("div")
        main.innerHTML = `
        <h1> Избранные книги - ${this.appState.favorites.length}</h1>
       
        `
    
        const cardlist = new CardList(this.appState, {bookList: this.appState.favorites}).render()
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