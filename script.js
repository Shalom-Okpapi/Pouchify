// Navigation
const leftBtn = document.querySelector('.left-btn');
const rightBtn = document.querySelector('.right-btn');
const itemWrapper = document.querySelector('.itemWrapper');

let scrollPosition = 0;
const scrollAmount = 200;

leftBtn.addEventListener('click', () => {
    scrollPosition -= scrollAmount;
    itemWrapper.style.transform = `translateX(${scrollPosition}px)`;
});

rightBtn.addEventListener('click', () => {
    scrollPosition += scrollAmount;
    itemWrapper.style.transform = `translateX(${scrollPosition}px)`;
});