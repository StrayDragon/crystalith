/** Map Material Tailwind `color` names onto Tailwind 3 palettes we already ship. */
export function textColorClass(color: string | undefined): string | undefined {
  switch (color) {
    case 'red':
      return 'text-red-500';
    case 'green':
      return 'text-green-500';
    case 'amber':
      return 'text-amber-500';
    case 'blue':
      return 'text-blue-500';
    case 'gray':
      return 'text-gray-500';
    case 'blue-gray':
      return 'text-gray-700';
    case 'white':
      return 'text-white';
    default:
      return undefined;
  }
}

export function filledBgClass(color: string | undefined): string {
  switch (color) {
    case 'red':
      return 'bg-red-500 text-white';
    case 'green':
      return 'bg-green-500 text-white';
    case 'amber':
      return 'bg-amber-500 text-white';
    case 'gray':
      return 'bg-gray-500 text-white';
    case 'blue-gray':
      return 'bg-gray-700 text-white';
    default:
      return 'bg-blue-500 text-white';
  }
}

export function outlinedToneClass(color: string | undefined): string {
  switch (color) {
    case 'red':
      return 'border-red-500 text-red-500';
    case 'green':
      return 'border-green-500 text-green-500';
    case 'amber':
      return 'border-amber-500 text-amber-500';
    case 'gray':
      return 'border-gray-500 text-gray-700';
    case 'blue-gray':
      return 'border-gray-500 text-gray-700';
    default:
      return 'border-blue-500 text-blue-500';
  }
}

export function chipToneClass(variant: string | undefined, color: string | undefined): string {
  if (variant === 'ghost' || variant === 'outlined') {
    switch (color) {
      case 'red':
        return 'bg-red-50 text-red-700';
      case 'green':
        return 'bg-green-50 text-green-700';
      case 'amber':
        return 'bg-amber-50 text-amber-800';
      case 'blue':
        return 'bg-blue-50 text-blue-700';
      case 'gray':
      case 'blue-gray':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }
  return filledBgClass(color);
}
