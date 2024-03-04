let isPlaying = false

let muted = false
let volume = 50
let duration = 50

const pauseElement = document.getElementById('pause')
const playElement = document.getElementById('play')

const timeElapsed = document.getElementById('time')
const totalTime = document.getElementById('totalTime')

const songTitle = document.getElementById('songTitle')

const mutedSpeaker = document.getElementById('volumeMute')
const lowSpeaker = document.getElementById('volumeLow')
const mediumSpeaker = document.getElementById('volumeMedium')
const highSpeaker = document.getElementById('volumeHigh')

const songSlider = document.getElementById('song')
const volumeSlider = document.getElementById('volume')

const togglePausePlay = () => {
    if (isPlaying) {
        pauseElement.style.display = "none";
        playElement.style.display = "block";

        isPlaying = false;
    } else {
        pauseElement.style.display = "block";
        playElement.style.display = "none";

        isPlaying = true;
    }
}

const syncVolume = () => {
    mutedSpeaker.style.display = "none"
    lowSpeaker.style.display = "none"
    mediumSpeaker.style.display = "none"
    highSpeaker.style.display = "none"

    if (muted) {
        mutedSpeaker.style.display = "block"
    } else {
        if (volume >= 50) {
            highSpeaker.style.display = "block"
        } else if (volume > 0) {
            mediumSpeaker.style.display = "block"
        } else if (volume == 0) {
            mutedSpeaker.style.display = "block"
        }
    }
}

const syncDuration = () => {

}

document.getElementById('volumeControl').addEventListener('click', async () => {
    muted = !muted
    syncVolume()
})

songSlider.addEventListener('change', async () => {
    duration = songSlider.value
    totalTime.innerText = "0:00"
    syncDuration()
})

volumeSlider.addEventListener('change', async () => {
    volume = volumeSlider.value
    timeElapsed.innerText = "99:99"
    syncVolume()
})

document.getElementById('shuffle').addEventListener('click', async () => {
    alert("shuffle")
})
document.getElementById('previous').addEventListener('click', async () => {
    alert("previous")
})


document.getElementById('pause-play').addEventListener('click', async () => {
    togglePausePlay()
})


document.getElementById('forward').addEventListener('click', async () => {
    alert("forward")
})
document.getElementById('repeat').addEventListener('click', async () => {
    alert("repeat")
})
