"use strict"

import { MainPage } from "./pages/main/main.js"
import { NotFoundPage } from "./pages/not-found/not-found.js"
import { FavoritePage } from "./pages/favorites/favorites.js"
import { AboutBookPage } from "./pages/about-book/about-book.js"

class App {

    routes = [
        {
            path: "",
            page: MainPage,
        },

        {
            path: "#favorites",
            page: FavoritePage,
        },

        {
            path: "#about-book",
            page: AboutBookPage,
        }
    ]


    appState = {
        favorites: [],
        searchBookId: null
    }

    constructor() {
        window.addEventListener("hashchange", this.route.bind(this))
        this.route()
    
    }

    route() {
        const page = this.routes.find((r) => r.path === location.hash)?.page
        if(!page) {
            this.currentPage = new NotFoundPage()
            this.currentPage.render()
            return;
        }
        this.currentPage = new page(this.appState)
        this.currentPage.render()
    }
}

new App()