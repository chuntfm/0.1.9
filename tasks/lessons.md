# Lessons

Patterns and corrections to follow in this project.

## Mobile borders
- On mobile, all borders should be thin (1px). On desktop, header borders are thick (2px), content borders thin (1px).
- When elements are shown/hidden via JS (like the tz-row), their borders must be accounted for to prevent doubling. Use CSS classes toggled by the same JS that shows/hides elements.
- Adjacent elements each having `border-bottom` creates visual doubling on mobile since table-layout collapse doesn't apply in block mode.

## Swup navigation consistency
- The experience MUST be identical whether a page is loaded directly (first load) or navigated to via Swup. This applies to: borders, titles, element visibility, data fetching, and all visual state.
- Any state managed by JS (classes, inline styles, fetched data) must be correctly set both on initial DOMContentLoaded AND in Swup's `page:view` hook.
- Test both paths: direct URL load and Swup navigation for every UI change.
