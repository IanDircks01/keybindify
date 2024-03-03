let isPlaying = false

const togglePausePlay = () => {
    if (isPlaying) {

        document.getElementById('pause').style.display = "none";
        document.getElementById('play').style.display = "block";

        isPlaying = false;
    } else {

        document.getElementById('pause').style.display = "block";
        document.getElementById('play').style.display = "none";

        isPlaying = true;
    }
}

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
