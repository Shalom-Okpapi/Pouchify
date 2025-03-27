
    //Hamburger BTN
function toggleSidebar(event) {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    sidebar.classList.toggle('active');
    hamburger.classList.toggle('close');
} 

document.addEventListener('DOMContentLoaded', function () {
    const container = document.querySelector('.fourth_section .container');
    const scrollAmount = 200; // Adjust the scroll amount as needed
    const scrollDelay = 3000; // Adjust the delay between scrolls

    function autoScroll() {
        if (container.scrollLeft + container.clientWidth >= container.scrollWidth) {
            container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }

    let scrollInterval = setInterval(autoScroll, scrollDelay);

    // Pause auto-scroll on hover
    container.addEventListener('mouseenter', () => clearInterval(scrollInterval));
    container.addEventListener('mouseleave', () => {
        scrollInterval = setInterval(autoScroll, scrollDelay);
    });
});


