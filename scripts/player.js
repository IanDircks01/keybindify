let isPlaying = false

let muted = false
let repeat = false
let shuffle = false
let loved = false
let volume = 0
let duration = 0

let currentSongID = undefined

let songLength = 0

let devices = undefined

const loveElement = document.getElementById('love')
const deviceElement = document.getElementById('device')

const pauseElement = document.getElementById('pause')
const playElement = document.getElementById('play')

const shuffleElement = document.getElementById('shuffle')
const repeatElement = document.getElementById('repeat')

const timeElapsed = document.getElementById('time')
const totalTime = document.getElementById('totalTime')

const songTitle = document.getElementById('songTitle')

const mutedSpeaker = document.getElementById('volumeMute')
const lowSpeaker = document.getElementById('volumeLow')
const mediumSpeaker = document.getElementById('volumeMedium')
const highSpeaker = document.getElementById('volumeHigh')

const playbackSlider = document.getElementById('song')
const volumeSlider = document.getElementById('volume')

let player = undefined

const millisToMinutesAndSeconds = (millis) => {
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}

const syncPausePlay = () => {
    if (isPlaying) {
        pauseElement.style.display = "block"
        playElement.style.display = "none"
    } else {
        pauseElement.style.display = "none"
        playElement.style.display = "block"
    }
}

const syncShuffle = () => {
    if (shuffle) {
        if (shuffleElement.classList.contains('disabled')) {
            shuffleElement.classList.remove('disabled')
        }
    } else {
        if (!shuffleElement.classList.contains('disabled')) {
            shuffleElement.classList.add('disabled')
        }
    }
}

const syncRepeat = () => {
    if (repeat) {
        if (repeatElement.classList.contains('disabled')) {
            repeatElement.classList.remove('disabled')
        }
    } else {
        if (!repeatElement.classList.contains('disabled')) {
            repeatElement.classList.add('disabled')
        }
    }
}

const syncLove = () => {
    if (loved) {
        if (loveElement.classList.contains('disabled')) {
            loveElement.classList.remove('disabled')
        }
    } else {
        if (!loveElement.classList.contains('disabled')) {
            loveElement.classList.add('disabled')
        }
    }
}

const syncDuration = () => {
    playbackSlider.value = duration
}

const syncVolume = () => {
    volumeSlider.value = volume

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

const syncPlayerState = async () => {
    const data = await window.electronAPI.getPlayerState()

    if (data != undefined) {
        const song = data.item
        const device = data.device

        if (data.item.id != currentSongID) {
            currentSongID = data.item.id
            await newSongStarted()
        }

        isPlaying = data.is_playing
        syncPausePlay()

        repeat = data.repeat_state != "off"
        shuffle = data.shuffle_state

        syncRepeat()
        syncShuffle()

        songTitle.innerHTML = `<b>${song.name}</b> - ${song.artists.map(item => item.name).toString()}`

        songLength = song.duration_ms

        totalTime.innerText = millisToMinutesAndSeconds(song.duration_ms)
        timeElapsed.innerText = millisToMinutesAndSeconds(data.progress_ms)
        duration = (data.progress_ms / song.duration_ms) * 100
        syncDuration()

        volume = device.volume_percent
        syncVolume()
    } else {
        songTitle.innerText = "Not Playing"
    }
}

const newSongStarted = async () => {
    loved = await window.electronAPI.checkLove(currentSongID)
    syncLove()
}

document.getElementById('volumeControl').addEventListener('click', async () => {
    muted = !muted

    if (muted) {
        window.electronAPI.setVolumeState(0)
    } else {
        window.electronAPI.setVolumeState(volume)
    }

    syncVolume()
})

playbackSlider.addEventListener('change', async () => {
    duration = playbackSlider.value
    syncDuration()
    let timeToSeek = Math.trunc(songLength * (duration / 100))
    timeElapsed.innerText = millisToMinutesAndSeconds(timeToSeek)
    window.electronAPI.seekToPosition(timeToSeek)
})

volumeSlider.addEventListener('change', async () => {
    volume = volumeSlider.value
    syncVolume()
    window.electronAPI.setVolumeState(volume)
})

loveElement.addEventListener('click', async () => {
    if (loved) {
        window.electronAPI.unloveTrack(currentSongID)
    } else {
        window.electronAPI.loveTrack(currentSongID)
    }

    loved = !loved
    syncLove()
})

deviceElement.addEventListener('click', async () => {
    window.electronAPI.showDeviceChooser()
})

document.getElementById('shuffle').addEventListener('click', async () => {
    shuffle = !shuffle
    syncShuffle()
    window.electronAPI.setShuffleState(shuffle)
})
document.getElementById('previous').addEventListener('click', async () => {
    window.electronAPI.skipToPrevious()
})

document.getElementById('pause-play').addEventListener('click', async () => {
    if (isPlaying) {
        window.electronAPI.pausePlayback()
    } else {
        window.electronAPI.resumePlayback()
    }

    isPlaying = !isPlaying
    
    syncPausePlay()
})

document.getElementById('forward').addEventListener('click', async () => {
    window.electronAPI.skipToNext()
})
document.getElementById('repeat').addEventListener('click', async () => {
    repeat = !repeat
    syncRepeat()
    window.electronAPI.setRepeatState(repeat ? "track" : "off")
})

window.addEventListener('load', async () => {
    await syncPlayerState()
    devices = await window.electronAPI.getDevices()

    const playInterval = setInterval(() => {
        syncPlayerState()
    }, 1000)
})

window.onSpotifyWebPlaybackSDKReady = async () => {
    let { expire, token } = await window.electronAPI.getAccessToken()

    player = new Spotify.Player({
        name: 'Keybindify',
        getOAuthToken: cb => { cb(token) },
        volume: volume
    })

    // Ready
    player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id)
    });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id)
    })

    player.addListener('initialization_error', ({ message }) => {
        console.error(message)
    })

    player.addListener('authentication_error', ({ message }) => {
        console.error(message)
    })

    player.addListener('account_error', ({ message }) => {
        console.error(message)
    })

    player.connect()
    
}

window.addEventListener('beforeunload', (event) => {
    player.disconnect()
})