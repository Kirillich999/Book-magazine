import "./card.css"
import { DivCoomponent } from "../../common/classes/div-component.js";



export class Card extends DivCoomponent {
    constructor(appState, cardState) {
        super()
        this.appState = appState
        this.cardState = cardState
    }




    #addFavoriteBook() {
        this.appState.favorites.push(this.cardState) 
    }

    #removeFavoriteBook() {
        this.appState.favorites = this.appState.favorites.filter((b) => b.key !== this.cardState.key)
    }


    #setSearchBookId() {
        this.appState.searchBookId = this.cardState.edition_key[0]
    }

    render() {
        const isFavorites = this.appState.favorites.find(b => b.key === this.cardState.key)
        this.element.innerHTML = ""
        this.element.classList.add("card")
        this.element.innerHTML = `
        <a href="#about-book" class="card__image">
            <img src="https://covers.openlibrary.org/b/id/${this.cardState.cover_i}-S.jpg" alt="Обложка">
        </a>
        <div class="card__info">
            <div class="card__genre">
                ${this.cardState.subject ? this.cardState.subject?.slice(0,1)?.join(" & ") : "Не задано"}
            </div>
            <div class="card__name">
            ${this.cardState.title}
            </div>

            <div class="card__author">
            ${this.cardState.author_name}
            </div>

            <div class="card__footer">
                <button class="button__add ${isFavorites ? "button__active":"" }">
                    ${
                        isFavorites ?
                        `<img src="../../../static/favorites.svg" />`
                        :
                        `<img src="../../../static/favorite-white.svg" />`
                    }
                </button>
            </div>

        </div>

        
       
        `
        if(isFavorites) {
            this.element.querySelector("button").addEventListener("click", this.#removeFavoriteBook.bind(this))
        }

        else {
            this.element.querySelector("button").addEventListener("click", this.#addFavoriteBook.bind(this))

        }


        this.element.querySelector("a").addEventListener("click", this.#setSearchBookId.bind(this))

        return this.element
    }

}