const form = document.getElementById('searchForm')
const searchInput = document.getElementById('searchTerm')

form.addEventListener('submit', (e) => {
    e.preventDefault()

    if (searchInput.value != "") {
        window.electronAPI.searchForSong(searchInput.value).then((data) => {
            searchInput.value = ""
        })
    }
})