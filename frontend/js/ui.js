/**
 * UI Utilities for .Connect
 * Handles custom themed components that replace browser defaults.
 */

window.initCustomSelects = function() {
    const selects = document.querySelectorAll('select.form-control');
    
    selects.forEach(select => {
        if (select.parentElement.classList.contains('custom-select-wrapper')) return;

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        
        // Hide original select (visually)
        select.style.display = 'none';

        // Create Trigger (the box you click)
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        const selectedOption = select.options[select.selectedIndex];
        trigger.innerHTML = `<span>${selectedOption ? selectedOption.text : 'Select...'}</span>
                             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                             </svg>`;
        wrapper.appendChild(trigger);

        // Create Options list
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-options';
        
        Array.from(select.options).forEach(option => {
            const customOption = document.createElement('div');
            customOption.className = `custom-option ${option.selected ? 'selected' : ''}`;
            customOption.innerText = option.text;
            customOption.dataset.value = option.value;
            
            if (option.disabled) {
                customOption.style.opacity = '0.5';
                customOption.style.pointerEvents = 'none';
            }

            customOption.addEventListener('click', () => {
                // Update original select
                select.value = option.value;
                select.dispatchEvent(new Event('change'));
                
                // Update trigger text
                trigger.querySelector('span').innerText = option.text;
                
                // Update visual selection
                wrapper.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
                customOption.classList.add('selected');
                
                // Close
                wrapper.classList.remove('open');
            });

            optionsContainer.appendChild(customOption);
        });

        wrapper.appendChild(optionsContainer);

        // Toggle logic
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other custom selects
            document.querySelectorAll('.custom-select-wrapper').forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });
            wrapper.classList.toggle('open');
        });
    });

    // Close on click outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
    });
};
