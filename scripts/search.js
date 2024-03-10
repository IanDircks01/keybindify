const form = document.getElementById('searchForm')
const mainArea = document.getElementById('main')
const searchInput = document.getElementById('searchTerm')
const searchButton = document.getElementById('searchIcon')

const sizeOffset = 20
const sizeOfResult = 50

const searchSongs = () => {
    if (searchInput.value != "") {
        window.electronAPI.searchForSong(searchInput.value).then((data) => {
            window.electronAPI.resizeSearchWindow((mainArea.clientHeight + sizeOffset) + (sizeOfResult * data.length), mainArea.clientWidth)
            window.electronAPI.addSongToQueue(data[0].uri).then((data2) => {
                searchInput.value = ""
            })
        })
    }
}

function focusSearch() {
    window.electronAPI.resizeSearchWindow(800, 60)
    searchInput.focus()
}

form.addEventListener('submit', (e) => {
    e.preventDefault()
    searchSongs()
})

searchButton.addEventListener('click', () => {
    searchSongs()
})