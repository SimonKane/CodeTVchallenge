import { gsap } from "gsap";

const street = document.querySelector<HTMLElement>(".hero-street");
const flash = document.querySelector<HTMLElement>(".hero-flash");
const darkness = document.querySelector<HTMLElement>(".hero-darkness");
const copy = document.querySelector<HTMLElement>(".hero-copy");

if (street && flash && darkness && copy) {
  const timeline = gsap.timeline({
    defaults: {
      ease: "power2.inOut",
    },
  });

  timeline
    // First flash: the street briefly becomes visible.
    .to(
      flash,
      {
        opacity: 0.75,
        duration: 0.06,
      },
      1.2,
    )
    .to(
      street,
      {
        opacity: 1,
        duration: 0.01,
      },
      1.2,
    )
    .to(flash, {
      opacity: 0,
      duration: 0.18,
    })
    .to(
      street,
      {
        opacity: 0,
        duration: 0.35,
      },
      "<",
    )

    // Andra blixten: scenen stannar kvar.
    .to(
      flash,
      {
        opacity: 0.9,
        duration: 0.07,
      },
      2.7,
    )
    .to(
      street,
      {
        opacity: 1,
        duration: 0.01,
      },
      2.7,
    )
    .to(flash, {
      opacity: 0,
      duration: 0.28,
    })
    .to(
      darkness,
      {
        backgroundColor: "rgba(0, 0, 0, 0.38)",
        duration: 1.2,
      },
      "<",
    )
    .to(
      copy,
      {
        opacity: 1,
        y: 0,
        duration: 1.1,
      },
      "-=0.45",
    );
}
