import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import * as dat from 'lil-gui'

/**
 * Base
 */
// Debug
const gui = new dat.GUI()

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Textures
 */
const textureLoader = new THREE.TextureLoader()
const matcapTexture = textureLoader.load('textures/matcaps/8.png')

const downPlanes = {};// пул где будут храниться анимации "Опускание холма"
let lastPlane = null;
let progress = 0;
let upPlane = false;
const landscapeArray = []

// Material
const material = new THREE.MeshMatcapMaterial({ matcap: matcapTexture })


// Plane
// const planeGeometry = new THREE.PlaneBufferGeometry(1,1,32,32)
const planeMaterial = new THREE.MeshStandardMaterial({color:"green"})
for(let x = -2.5; x < 2.5; x++) {
    for(let z = -2.5; z < 2.5; z++) {
        const planeGeometry = new THREE.PlaneBufferGeometry(1,1,32,32)
        const bushMaterial = new THREE.MeshStandardMaterial({ color: '#89c854', side: THREE.DoubleSide })
        const plane = new THREE.Mesh(planeGeometry, bushMaterial);
        plane.geometry.rotateX(-Math.PI/2);//Изначально плоскости размещены вертикально, требуется повернуть их геометрии на 90 градусов.
        plane.position.set(x,0,z);
        scene.add(plane)
        landscapeArray.push({floor: 0, progress: 0, mesh: plane, isAnimating: false})
    }
}

// lights
const light1 = new THREE.AmbientLight( 0xdddddd,0.5 );// Рассеянный свет
scene.add(light1);

const light2 = new THREE.DirectionalLight( 0xaaaaaa, 0.5 );// Направленный свет
light2.position.set(3,3,-1);
scene.add(light2);

const light3 = new THREE.DirectionalLight( 0xaaaaaa, 0.5 );// Направленный свет
light2.position.set(3,-3,-1);
scene.add(light3);


/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 1, 100)
camera.position.x = 1
camera.position.y = 1
camera.position.z = 2
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Listeners
 */


const raycasterField = (event) => {
    const raycaster = new THREE.Raycaster();// Объект рейкастер, который будет отправлять луч из толчки клика в сцену
    const point = new THREE.Vector2(//Точка на экране, которая конвертируется в точку в 3d пространстве
        (event.clientX / renderer.domElement.offsetWidth) * 2 - 1,
        - (event.clientY / renderer.domElement.offsetHeight) * 2 + 1
    );
    raycaster.setFromCamera( point, camera );// Добавляем точку в рейкастер и в качестве направления указываем направление обзора камеры
    return raycaster.intersectObjects(scene.children);// Пускаем луч из точки, проверяем мог ли он попасть в какой-то дочерний объект сцены.
}

const onClick = (event) => {
    const intersects = raycasterField(event)
    if (intersects.length > 0) {
        const plane = landscapeArray.find(item => item.mesh.id === intersects[0].object.id)
        if (plane.isAnimating) return
        switch (event.button) {
            case 0:
                if (plane.floor < 1) plane.floor += 1
                break;
            case 2:
                if (plane.floor > -1) plane.floor -= 1
                break;
        }
        plane.progress = 0
        plane.isAnimating = true
    }
    console.log(landscapeArray)
}
const onClick1 = (event) => {
    const intersects = raycasterField(event)
    if (intersects.length > 0) {// Проверяем есть ли попадание луча, хотя бы в один объект
        if (lastPlane) downPlanes[lastPlane.id] = lastPlane;// Если мы уже попадали лучом, то добавляем предыдущую плоскость в пул анимаций "Уменьшение холма"
        lastPlane = upPlane = intersects[0].object;// Добавляем плоскость в анимацию "Увеличение холма"
        const plane = landscapeArray.find(item => item.mesh.id === intersects[0].object.id)
        switch (event.button) {
            case 0:
                plane.floor += 1
                break;
            case 2:
                plane.floor -= 1
                break;
        }
        plane.progress = 0

        progress = 0;// Обнуляем прогресс  анимации
    }
    console.log(landscapeArray)
}

const onHover = (event) => {
    const intersects = raycasterField(event)
    if (intersects.length > 0) {
        for (let mesh of scene.children.filter(item => item.type === 'Mesh')) {
            mesh.material.color.set('#89c854');
        }
        intersects[0].object.material.color.set('#94d35f');
    }
}
const animate = () => {
    //Анимация  "Увеличение холма"
    const planeAnimatingArray = landscapeArray.filter(item => item.isAnimating )
    if (planeAnimatingArray) {// Если есть плоскость для анимации
        for (let planeObj of planeAnimatingArray) {
            const plane = planeObj.mesh
            let length;
            let height = 0;
            let pointV = new THREE.Vector3();
            let positions = plane.geometry.attributes.position.array;// Массив со всеми координатами точек плоскости, в нем они идут по очереди xyzxyzxyzxyz и так далее (например, если треугольников 8 то массив будет размером 24)
            planeObj.progress += .01;// обновляем прогресс анимации
            for(let i = 0; i < positions.length; i+=3){//Проходимся по всем точкам.
                switch (planeObj.floor) {
                    case -1:
                        pointV.set(positions[i],positions[i+1],positions[i+2]);//Используем вектор для просчета расстояния от центра плоскости до точки

                        length = pointV.length();//Находим расстояние
                        if (planeObj.progress > length) positions[i+1] -= Math.sin(planeObj.progress - length);
                        break;
                    case 0:
                        if (positions[i+1] > 0)positions[i+1] -= 0.01;// Если точка по Y выше нуля то опускам её
                        else positions[i+1] = 0; // Если ниже нуля, то возвращаем к нулю

                        height += positions[i+1];//Собираем общую высоту всех точек
                        break;
                    case 1:
                        pointV.set(positions[i],positions[i+1],positions[i+2]);//Используем вектор для просчета расстояния от центра плоскости до точки

                        length = pointV.length();//Находим расстояние
                        if (planeObj.progress > length) positions[i+1] += Math.sin(planeObj.progress - length);
                        break;
                }
            }
            plane.geometry.attributes.position.needsUpdate = true;//Обновляем позиции, чтобы новые координаты, были отравлены в GPU память
            plane.geometry.computeVertexNormals();// Обновляем нормали, чтобы искажение плоскости реагировало на источники света
            if (planeObj.progress >= .5){//Если прогресс больше .5 (это расстояние от цетра плоскости до её грани) останавливаем анимацию
                planeObj.isAnimating = false;
            }
        }

    }
}
const animate1 = () => {
    //Анимация  "Увеличение холма"
    if (upPlane){// Если есть плоскость для анимации
        let length;
        let pointV = new THREE.Vector3();
        let positions = upPlane.geometry.attributes.position.array;// Массив со всеми координатами точек плоскости, в нем они идут по очереди xyzxyzxyzxyz и так далее (например, если треугольников 8 то массив будет размером 24)
        progress += .01;// обновляем прогресс анимации
        for(let i = 0; i < positions.length; i+=3){//Проходимся по всем точкам.

            pointV.set(positions[i],positions[i+1],positions[i+2]);//Используем вектор для просчета расстояния от центра плоскости до точки

            length = pointV.length();//Находим расстояние

            if (progress > length) positions[i+1] += Math.sin(progress - length);// Если расстояние до точки меньше чем условный прогресс, то поднимает точку по y. Синус нужно чтобы форма холма была не в виде конуса, а как пузырь
        }
        upPlane.geometry.attributes.position.needsUpdate = true;//Обновляем позиции, чтобы новые координаты, были отравлены в GPU память
        upPlane.geometry.computeVertexNormals();// Обновляем нормали, чтобы искажение плоскости реагировало на источники света
        if (progress >= .5){//Если прогресс больше .5 (это расстояние от цетра плоскости до её грани) останавливаем анимацию
            upPlane = false;
        }

    }
    // Анимация "Уменьшение холма"
    for (let id in downPlanes){// Если в пуле объектов есть те которые нужно опустить.
        let height = 0;// Суммы высот всех точек
        let positions = downPlanes[id].geometry.attributes.position.array;// Массив координатами точек
        for (let i = 0; i < positions.length; i+=3){

            if (positions[i+1] > 0)positions[i+1] -= 0.01;// Если точка по Y выше нуля то опускам её
            else positions[i+1] = 0; // Если ниже нуля, то возвращаем к нулю

            height += positions[i+1];//Собираем общую высоту всех точек
        }
        downPlanes[id].geometry.attributes.position.needsUpdate = true;
        downPlanes[id].geometry.computeVertexNormals();
        if (height <= 0) delete downPlanes[id]; // Если все точки в нулевой позиции, то удаляем объект из пула анимаций "Уменьшение холма".
    }
}
renderer.domElement.addEventListener( 'pointerup', onClick, false);
renderer.domElement.addEventListener( 'mousemove', onHover);

/**
 * Animate
 */

const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update controls
    controls.update()


    // Render
    renderer.render(scene, camera)

    // Animate landscape
    animate();

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()