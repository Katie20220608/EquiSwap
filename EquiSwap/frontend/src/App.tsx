import { TopNav } from "./components/TopNav";
import "./App.css";

function App() {
  return (
    <main className="landing-page">
      <TopNav
        eyebrow="EquiSwap / for families"
        heading="A better way to pass children's things along."
      />

      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow">Swap, reuse, grow</p>
          <h2 id="hero-heading">
            Children outgrow things. Their next family is waiting.
          </h2>
          <p className="hero-summary">
            EquiSwap helps parents swap children's toys and learning resources
            through fair, direct exchanges. Pass on what your child has
            outgrown, find something useful for their next stage, and keep good
            things in play.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="/register">
              Start your swap journey <span aria-hidden="true">↗</span>
            </a>
            <a className="secondary-action" href="#how-it-works">
              See how it works <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="hero-note">
            Less waste. More play. Better matches for growing families.
          </p>
        </div>
        <div className="hero-image-wrap">
          <img
            className="hero-image"
            src="https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1200&q=85"
            alt="Colourful children's toys arranged for play"
          />
          <div className="hero-caption">
            <span className="status-dot" />
            <span>
              One child’s outgrown toy can start another child’s story.
            </span>
          </div>
        </div>
      </section>

      <section className="purpose-strip" aria-label="EquiSwap benefits">
        <p className="eyebrow">Why families swap</p>
        <div className="purpose-points">
          <span>Keep toys and resources in circulation.</span>
          <span>Save money as children grow and learn.</span>
          <span>Connect with other local parents.</span>
        </div>
      </section>

      <section
        className="how-section"
        id="how-it-works"
        aria-labelledby="how-heading"
      >
        <div className="section-heading">
          <p className="eyebrow">The family-friendly version</p>
          <h2 id="how-heading">A simple circle for growing minds.</h2>
          <p>
            A few details are all it takes to turn outgrown toys and learning
            resources into useful discoveries for another child.
          </p>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">Step 1</span>
            <div className="step-image step-image-list">
              <img
                src="https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=700&q=80"
                alt="Wooden building blocks ready to be listed"
              />
            </div>
            <h3>List what your child has outgrown</h3>
            <p>
              Add a photo and a description for toys, books, puzzles, and
              learning resources ready for a new home.
            </p>
          </article>
          <article className="step-card">
            <span className="step-number">Step 2</span>
            <div className="step-image step-image-wish">
              <img
                src="https://images.unsplash.com/photo-1618842676088-c4d48a6a7c9d?auto=format&fit=crop&w=700&q=80"
                alt="Children's picture books someone might be looking for"
              />
            </div>
            <h3>Wishlist the next thing they need</h3>
            <p>
              Tell other parents which toy, book, or resource would support your
              child’s next stage of play and learning.
            </p>
          </article>
          <article className="step-card">
            <span className="step-number">Step 3</span>
            <div className="step-image step-image-cycle">
              <img
                src="https://images.unsplash.com/photo-1599623560574-39d485900c95?auto=format&fit=crop&w=700&q=80"
                alt="Children playing with a colourful educational toy"
              />
            </div>
            <h3>Follow a fair swap cycle</h3>
            <p>
              When wishes connect, agree on a fair exchange and keep toys and
              learning resources moving between families.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="cta-heading">
        <div>
          <p className="eyebrow">Ready for the next stage?</p>
          <h2 id="cta-heading">Give children’s favourites a new chapter.</h2>
        </div>
        <a className="primary-action primary-action-light" href="/register">
          Join EquiSwap <span aria-hidden="true">↗</span>
        </a>
      </section>
    </main>
  );
}

export default App;
