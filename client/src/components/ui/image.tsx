import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

const Image = forwardRef<HTMLImageElement, ImageProps>(
  ({ className, alt, ...props }, ref) => {
    return (
      <img
        ref={ref}
        className={cn(
          "rounded-lg border bg-muted object-cover transition-all",
          className
        )}
        alt={alt}
        {...props}
      />
    )
  }
)
Image.displayName = "Image"

export { Image }
