import "./pagination.css"
import { DivCoomponent } from "../../common/classes/div-component.js";



export class Pagination extends DivCoomponent {
    constructor(state) {
        super()
        this.state = state
    
    }


    #decreasePage() {
        this.state.page -= 1

    }

    #increasePage() {
        this.state.page += 1

    }



    render() {
        this.element.innerHTML = ""
        this.element.classList.add("pagination")
        this.element.innerHTML = `
        <button id="prev__page" class="pagination__btn">
        <img src="../../../static/arrowBack.svg" alt="Arrow back">
         Предыдущая страница
        </button>

       <button id="next__page" class="pagination__btn">
        Следующая страница
        <img src="../../../static/arrownext.svg" alt="Arrow next">
   
        </button>
   
        `
       this.element.querySelector("#prev__page").addEventListener("click", this.#decreasePage.bind(this))
       this.element.querySelector("#next__page").addEventListener("click", this.#increasePage.bind(this))

        return this.element
    }

}