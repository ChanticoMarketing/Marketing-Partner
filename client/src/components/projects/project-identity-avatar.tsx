import { useEffect, useState } from "react";
import { getProjectColor, getProjectInitial } from "@/lib/project-identity";

type ProjectIdentityAvatarProps = {
  name: string | null | undefined;
  color?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md";
};

export default function ProjectIdentityAvatar({
  name,
  color,
  imageUrl,
  size = "sm",
}: ProjectIdentityAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = size === "md" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs";

  useEffect(() => setImageFailed(false), [imageUrl]);

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={`Imagen de ${name || "proyecto"}`}
        className={`${sizeClass} shrink-0 rounded-full object-cover shadow-sm`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Identidad de ${name || "proyecto"}`}
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm`}
      style={{ backgroundColor: getProjectColor(color) }}
    >
      {getProjectInitial(name)}
    </div>
  );
}
