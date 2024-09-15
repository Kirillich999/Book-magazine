import "./card-list.css"
import { DivCoomponent } from "../../common/classes/div-component.js";
import { Card } from "../card/card.js";



export class CardList extends DivCoomponent {
    constructor(appState, parentState) {
        super()
        this.appState = appState
        this.parentState = parentState
    }

    render() {

        if(this.parentState.isLoading) {
            const h1 = document.createElement("h1")
                h1.innerHTML = "Загрузка. . . "
                this.element.append(h1)
                return this.element
            

        }

        const cardGrid = document.createElement("div")
        cardGrid.classList.add("card__grid")
        this.element.append(cardGrid)

        // this.element.innerHTML = ""
        // this.element.classList.add("card__list")
       


        for(const book of this.parentState.bookList) {
            cardGrid.append( new Card(this.appState, book).render())
        }
        return this.element
    }

}