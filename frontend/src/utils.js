export const qs = (selector) => document.querySelector(selector)
export const qsa = (selector) => document.querySelectorAll(selector)
export const getElById = (id) => document.getElementById(id)

export const addClass = (el, className) => el.classList.add(className)
export const removeClass = (el, className) => el.classList.remove(className)
export const hasClass = (el, className) => el.classList.contains(className)
