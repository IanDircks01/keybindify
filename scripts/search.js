const form = document.getElementById('searchForm')
const searchInput = document.getElementById('searchTerm')
const searchButton = document.getElementById('searchIcon')

const searchSongs = () => {
    if (searchInput.value != "") {
        window.electronAPI.searchForSong(searchInput.value).then((data) => {
            window.electronAPI.addSongToQueue(data[0].uri).then((data) => {
                searchInput.value = ""
            })
        })
    }
}

function focusSearch() {
    searchInput.focus()
}

form.addEventListener('submit', (e) => {
    e.preventDefault()
    searchSongs()
})

searchButton.addEventListener('click', () => {
    searchSongs()
})