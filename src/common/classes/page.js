export class AbstractPage {

    constructor() {
        this.app = document.getElementById("root")
    }


    setTitle (title) {
        document.title = title
    }

    render() {
        return
    }

    errorHandler(error) {
        if(error instanceof Error) {
            console.log("Application is failed", error.message)
        }
    }
    unmount() {
        return
    }

}