let devices = undefined

const listArea = document.getElementById('listArea')

async function syncDeviceList() {
    devices = await window.electronAPI.getDevices()
    console.log(devices)
    while(listArea.hasChildNodes()) {
        listArea.firstChild.remove()
    }
    devices.forEach((device) => {
        let newNode = document.createElement("button")
        newNode.classList.add("device-btn")
        newNode.innerHTML = `Connect: <b>${device.name}</b>`

        newNode.onclick = () => {
            window.electronAPI.setDevice(device)
        }

        listArea.appendChild(newNode)
    })


}