/* =========================================================
   EVENT PAGE
   ========================================================= */

.featured-link {
  height: 44px;

  display: inline-flex;
  align-items: center;
  gap: 6px;

  padding: 0 15px;

  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 12px;

  background: rgba(255, 255, 255, 0.08);

  color: white;

  font-weight: 700;

  transition: 0.25s ease;
}

.featured-link:hover {
  transform: translateX(3px);

  border-color: rgba(56, 242, 147, 0.45);

  background: rgba(22, 224, 121, 0.13);
}

.event-arrow {
  width: 42px;
  height: 42px;

  display: grid;
  place-items: center;

  border: 1px solid rgba(56, 242, 147, 0.19);
  border-radius: 12px;

  background: rgba(22, 224, 121, 0.08);

  color: var(--green-bright);

  transition: 0.25s ease;
}

.event-card:hover .event-arrow {
  transform: translateX(4px);

  background: rgba(22, 224, 121, 0.17);
}

.event-page {
  min-height: 100vh;

  background:
    radial-gradient(
      circle at 12% 8%,
      rgba(22, 224, 121, 0.08),
      transparent 28%
    ),
    #07110d;

  color: white;
}

.event-page-header {
  width: min(1380px, calc(100% - 32px));
  height: 72px;

  position: fixed;

  z-index: 100;

  top: 14px;
  left: 50%;

  transform: translateX(-50%);

  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;

  padding: 0 18px;

  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 21px;

  background: rgba(5, 14, 10, 0.76);

  backdrop-filter: blur(22px);

  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}

.event-back,
.event-share {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  color: #aebdb5;

  font-size: 12px;
  font-weight: 700;
}

.event-back {
  justify-self: start;

  transition: 0.25s ease;
}

.event-back:hover {
  transform: translateX(-3px);

  color: white;
}

.event-share {
  justify-self: end;

  padding: 10px 13px;

  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;

  background: rgba(255, 255, 255, 0.03);
}

.event-hero {
  position: relative;

  min-height: 720px;

  overflow: hidden;

  display: flex;
  align-items: flex-end;

  padding: 160px max(24px, calc((100vw - 1320px) / 2)) 70px;
}

.event-hero-image,
.event-hero-overlay {
  position: absolute;
  inset: 0;
}

.event-hero-image img {
  width: 100%;
  height: 100%;

  object-fit: cover;

  animation: eventHeroZoom 16s ease-in-out infinite alternate;
}

@keyframes eventHeroZoom {
  from {
    transform: scale(1);
  }

  to {
    transform: scale(1.055);
  }
}

.event-hero-overlay {
  background:
    linear-gradient(
      90deg,
      rgba(3, 10, 7, 0.93) 0%,
      rgba(3, 10, 7, 0.72) 42%,
      rgba(3, 10, 7, 0.23) 72%
    ),
    linear-gradient(
      to top,
      #07110d 0%,
      rgba(7, 17, 13, 0.35) 40%,
      rgba(7, 17, 13, 0.08) 100%
    );
}

.event-hero-glow {
  position: absolute;

  width: 550px;
  height: 550px;

  left: -140px;
  bottom: -230px;

  border-radius: 50%;

  background: rgba(22, 224, 121, 0.1);

  filter: blur(90px);
}

.event-hero-content {
  position: relative;
  z-index: 3;

  width: min(850px, 100%);
}

.event-status {
  width: fit-content;

  display: flex;
  align-items: center;
  gap: 8px;

  margin-bottom: 20px;

  padding: 8px 11px;

  border: 1px solid rgba(56, 242, 147, 0.2);
  border-radius: 50px;

  background: rgba(22, 224, 121, 0.07);

  color: #c9f8de;

  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.event-status i {
  width: 7px;
  height: 7px;

  border-radius: 50%;

  background: var(--green-bright);

  box-shadow: 0 0 14px var(--green-bright);
}

.event-hero-category {
  color: var(--gold);

  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.2em;
}

.event-hero h1 {
  max-width: 900px;

  margin: 12px 0 25px;

  font-size: clamp(52px, 7vw, 98px);
  line-height: 0.91;
  letter-spacing: -0.06em;
}

.event-hero-info {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  margin-bottom: 32px;
}

.event-hero-info > span {
  display: flex;
  align-items: center;
  gap: 9px;

  min-height: 43px;

  padding: 0 13px;

  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 13px;

  background: rgba(255, 255, 255, 0.04);

  backdrop-filter: blur(12px);

  color: #d5e0da;

  font-size: 11px;
}

.event-hero-info svg {
  width: 16px;

  color: var(--green-bright);
}

.event-main {
  width: min(1320px, calc(100% - 44px));

  margin: 0 auto;
}

.event-information {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 60px;

  padding-top: 95px;
}

.event-about h2,
.attractions-section h2,
.ticket-section-title h2 {
  max-width: 780px;

  margin: 12px 0 20px;

  font-size: clamp(36px, 4vw, 58px);
  line-height: 1;
  letter-spacing: -0.05em;
}

.event-about > p {
  max-width: 780px;

  margin: 0;

  color: #91a49a;

  font-size: 15px;
  line-height: 1.8;
}

.event-highlights {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  max-width: 680px;

  margin-top: 30px;
}

.event-highlights > div {
  display: flex;
  align-items: center;
  gap: 9px;

  padding: 13px 14px;

  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 13px;

  background: rgba(255, 255, 255, 0.025);

  color: #c1d0c8;

  font-size: 11px;
}

.event-highlights svg {
  color: var(--green-bright);
}

.event-location-card {
  align-self: start;

  padding: 25px;

  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 23px;

  background:
    radial-gradient(
      circle at 100% 0%,
      rgba(22, 224, 121, 0.1),
      transparent 45%
    ),
    rgba(255, 255, 255, 0.025);

  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.15);

  transition: 0.35s ease;
}

.event-location-card:hover {
  transform: translateY(-6px);

  border-color: rgba(232, 200, 117, 0.2);
}

.location-icon {
  width: 48px;
  height: 48px;

  display: grid;
  place-items: center;

  margin-bottom: 24px;

  border: 1px solid rgba(56, 242, 147, 0.18);
  border-radius: 15px;

  background: rgba(22, 224, 121, 0.06);

  color: var(--green-bright);
}

.event-location-card > small {
  color: var(--gold);

  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.15em;
}

.event-location-card h3 {
  margin: 9px 0 15px;

  font-size: 23px;
}

.event-location-card p {
  margin: 5px 0;

  color: #81958a;

  font-size: 11px;
}

.event-location-card button {
  width: 100%;
  height: 44px;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;

  margin-top: 23px;

  border: 1px solid rgba(56, 242, 147, 0.15);
  border-radius: 12px;

  background: rgba(22, 224, 121, 0.07);

  color: var(--green-bright);

  font-weight: 800;

  transition: 0.25s ease;
}

.event-location-card button:hover {
  background: rgba(22, 224, 121, 0.14);
}

.attractions-section {
  margin-top: 130px;
}

.attraction-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 13px;

  margin-top: 30px;
}

.attraction-card {
  position: relative;

  min-height: 170px;

  display: flex;
  flex-direction: column;
  justify-content: flex-end;

  overflow: hidden;

  padding: 20px;

  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 19px;

  background:
    radial-gradient(
      circle at 80% 20%,
      rgba(22, 224, 121, 0.12),
      transparent 40%
    ),
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.035),
      rgba(255, 255, 255, 0.015)
    );

  transition:
    transform 0.35s ease,
    border-color 0.35s ease;
}

.attraction-card:hover {
  transform: translateY(-7px);

  border-color: rgba(232, 200, 117, 0.22);
}

.attraction-card > span {
  position: absolute;

  top: 18px;
  right: 18px;

  color: rgba(255, 255, 255, 0.08);

  font-size: 42px;
  font-weight: 900;
}

.attraction-card strong {
  font-size: 17px;
}

.attraction-card small {
  margin-top: 7px;

  color: var(--green-bright);

  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.ticket-section {
  margin-top: 145px;
  padding-bottom: 130px;

  scroll-margin-top: 110px;
}

.ticket-section-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 30px;

  margin-bottom: 35px;
}

.ticket-security {
  display: flex;
  align-items: center;
  gap: 10px;

  color: var(--green-bright);
}

.ticket-security > span {
  display: flex;
  flex-direction: column;

  color: #d4dfd9;

  font-size: 10px;
  font-weight: 800;
}

.ticket-security small {
  margin-top: 3px;

  color: #64786d;

  font-size: 8px;
  font-weight: 500;
}

.purchase-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  align-items: start;
  gap: 25px;
}

.ticket-options {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.ticket-option {
  position: relative;

  width: 100%;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 25px;

  padding: 21px;

  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 19px;

  background:
    linear-gradient(
      120deg,
      rgba(255, 255, 255, 0.025),
      rgba(255, 255, 255, 0.01)
    ),
    #0b1712;

  color: white;

  text-align: left;

  transition:
    transform 0.3s ease,
    border-color 0.3s ease,
    background 0.3s ease,
    box-shadow 0.3s ease;
}

.ticket-option:hover {
  transform: translateY(-4px) scale(1.005);

  border-color: rgba(232, 200, 117, 0.22);

  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
}

.ticket-option.selected {
  transform: translateY(-3px);

  border-color: rgba(232, 200, 117, 0.52);

  background:
    radial-gradient(
      circle at 90% 15%,
      rgba(232, 200, 117, 0.08),
      transparent 35%
    ),
    linear-gradient(
      120deg,
      rgba(22, 224, 121, 0.075),
      rgba(255, 255, 255, 0.01)
    ),
    #0b1712;

  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.24),
    0 0 45px rgba(22, 224, 121, 0.05);
}

.ticket-option-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ticket-option-icon {
  width: 48px;
  height: 48px;

  flex: 0 0 auto;

  display: grid;
  place-items: center;

  border: 1px solid rgba(56, 242, 147, 0.15);
  border-radius: 15px;

  background: rgba(22, 224, 121, 0.05);

  color: var(--green-bright);
}

.ticket-option-main span {
  color: var(--gold);

  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ticket-option-main h3 {
  margin: 5px 0;

  font-size: 19px;
}

.ticket-option-main p {
  margin: 0;

  color: #758a7e;

  font-size: 10px;
}

.ticket-option-price {
  flex: 0 0 140px;

  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.ticket-option-price small {
  color: #687d71;

  font-size: 8px;
}

.ticket-option-price strong {
  color: var(--gold-light);

  font-size: 19px;
}

.ticket-option-price span {
  color: #687d71;

  font-size: 8px;
}

.ticket-selected-check {
  position: absolute;

  top: -8px;
  right: -8px;

  width: 28px;
  height: 28px;

  display: grid;
  place-items: center;

  border: 2px solid #07110d;
  border-radius: 50%;

  background: var(--green);

  color: #03150c;

  opacity: 0;

  transform: scale(0.6);

  transition: 0.25s ease;
}

.ticket-option.selected .ticket-selected-check {
  opacity: 1;

  transform: scale(1);
}

.purchase-summary {
  position: sticky;

  top: 110px;

  min-height: 360px;

  overflow: hidden;

  padding: 23px;

  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;

  background:
    radial-gradient(
      circle at 100% 0%,
      rgba(22, 224, 121, 0.09),
      transparent 40%
    ),
    #0b1712;

  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.22);

  transition:
    border-color 0.4s ease,
    box-shadow 0.4s ease;
}

.purchase-summary.active {
  border-color: rgba(232, 200, 117, 0.18);

  box-shadow:
    0 35px 90px rgba(0, 0, 0, 0.3),
    0 0 60px rgba(22, 224, 121, 0.04);
}

.empty-summary {
  min-height: 315px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  text-align: center;
}

.empty-summary > div {
  width: 58px;
  height: 58px;

  display: grid;
  place-items: center;

  border: 1px solid rgba(56, 242, 147, 0.16);
  border-radius: 18px;

  background: rgba(22, 224, 121, 0.05);

  color: var(--green-bright);
}

.empty-summary h3 {
  margin: 17px 0 7px;
}

.empty-summary p {
  max-width: 250px;

  margin: 0;

  color: #6f8478;

  font-size: 10px;
  line-height: 1.7;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  padding-bottom: 18px;

  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.summary-header > span {
  color: var(--gold);

  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.15em;
}

.summary-header small {
  color: #65796e;

  font-size: 7px;
}

.summary-event {
  display: flex;
  align-items: center;
  gap: 12px;

  padding: 17px 0;

  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.summary-event img {
  width: 61px;
  height: 61px;

  flex: 0 0 auto;

  object-fit: cover;

  border-radius: 12px;
}

.summary-event > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.summary-event strong {
  font-size: 11px;
}

.summary-event span {
  color: #718579;

  font-size: 8px;
}

.summary-ticket {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;

  padding: 19px 0;
}

.summary-ticket > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-ticket small {
  color: #63776c;

  font-size: 7px;
}

.summary-ticket > div strong {
  font-size: 13px;
}

.summary-ticket > div span {
  color: var(--green-bright);

  font-size: 8px;
}

.summary-ticket > strong {
  color: var(--gold-light);

  font-size: 15px;
}

.quantity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 14px 0;

  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.quantity-row > span {
  color: #9caea4;

  font-size: 10px;
}

.quantity-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quantity-control button {
  width: 31px;
  height: 31px;

  display: grid;
  place-items: center;

  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9px;

  background: rgba(255, 255, 255, 0.04);

  color: white;

  transition: 0.2s ease;
}

.quantity-control button:hover {
  border-color: rgba(56, 242, 147, 0.25);

  background: rgba(22, 224, 121, 0.08);
}

.quantity-control strong {
  min-width: 18px;

  text-align: center;
}

.summary-values {
  padding: 15px 0;

  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.summary-values > div {
  display: flex;
  justify-content: space-between;

  margin: 7px 0;

  color: #7d9185;

  font-size: 9px;
}

.summary-values strong {
  color: #b6c6bd;

  font-weight: 600;
}

.summary-total {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;

  padding: 19px 0;
}

.summary-total span {
  font-size: 11px;
  font-weight: 700;
}

.summary-total strong {
  color: var(--gold-light);

  font-size: 25px;
}

.checkout-button {
  width: 100%;
  min-height: 52px;

  position: relative;

  overflow: hidden;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;

  border: 1px solid rgba(74, 255, 164, 0.5);
  border-radius: 14px;

  background: linear-gradient(
    135deg,
    #17cf72,
    #087c43
  );

  color: white;

  font-weight: 900;

  box-shadow: 0 17px 40px rgba(22, 224, 121, 0.18);

  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.checkout-button:hover {
  transform: translateY(-3px);

  box-shadow:
    0 22px 50px rgba(22, 224, 121, 0.28),
    0 0 30px rgba(22, 224, 121, 0.08);
}

.checkout-button::after {
  content: '';

  position: absolute;

  width: 35px;
  height: 150%;

  left: -65px;
  top: -25%;

  transform: rotate(20deg);

  background: rgba(255, 255, 255, 0.22);

  filter: blur(7px);

  transition: left 0.6s ease;
}

.checkout-button:hover::after {
  left: 120%;
}

.summary-security {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;

  margin-top: 14px;

  color: #61766a;

  font-size: 8px;
}

.summary-security svg {
  color: var(--green-bright);
}

.event-footer-page {
  width: min(1320px, calc(100% - 44px));

  display: flex;
  align-items: center;
  justify-content: space-between;

  margin: 0 auto;
  padding: 33px 0 42px;

  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.event-footer-page > span {
  color: #61746a;

  font-size: 9px;
}

.event-not-found {
  min-height: 100vh;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  background: #07110d;
  color: white;

  text-align: center;
}

.event-not-found svg {
  color: var(--green-bright);
}

.event-not-found a {
  display: flex;
  align-items: center;
  gap: 8px;

  margin-top: 15px;

  color: var(--green-bright);
}

@media (max-width: 1000px) {
  .event-information {
    grid-template-columns: 1fr;
  }

  .event-location-card {
    width: 100%;
  }

  .attraction-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .purchase-layout {
    grid-template-columns: 1fr;
  }

  .purchase-summary {
    position: relative;
    top: 0;
  }
}

@media (max-width: 720px) {
  .event-page-header {
    grid-template-columns: 1fr auto;

    height: 65px;
  }

  .event-page-header > .brand {
    display: none;
  }

  .event-share {
    font-size: 0;
  }

  .event-hero {
    min-height: 650px;

    padding: 130px 18px 45px;
  }

  .event-hero-overlay {
    background:
      linear-gradient(
        to top,
        #07110d 0%,
        rgba(4, 11, 8, 0.7) 48%,
        rgba(4, 11, 8, 0.22) 100%
      );
  }

  .event-hero h1 {
    font-size: clamp(48px, 15vw, 72px);
  }

  .event-hero-info {
    flex-direction: column;
    align-items: flex-start;
  }

  .event-main {
    width: calc(100% - 32px);
  }

  .event-information {
    gap: 35px;

    padding-top: 70px;
  }

  .event-highlights {
    grid-template-columns: 1fr;
  }

  .attractions-section {
    margin-top: 95px;
  }

  .attraction-grid {
    grid-template-columns: 1fr;
  }

  .ticket-section {
    margin-top: 105px;
  }

  .ticket-section-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .ticket-option {
    align-items: flex-start;
    flex-direction: column;
  }

  .ticket-option-price {
    flex: auto;

    align-items: flex-start;
  }

  .event-footer-page {
    width: calc(100% - 32px);

    flex-direction: column;
    gap: 20px;
  }
}