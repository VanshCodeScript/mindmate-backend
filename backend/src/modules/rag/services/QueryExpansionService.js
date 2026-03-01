/**
 * Query Expansion Service
 * Expands user queries with synonyms and related terms for better retrieval
 */

class QueryExpansionService {
  /**
   * Synonym mapping for common health/wellness/family queries
   */
  static synonymMap = {
    // Nutrition related
    protein: ['protein', 'amino acids', 'meat', 'fish', 'eggs', 'legumes', 'nutrition'],
    nutrition: ['nutrition', 'diet', 'food', 'eating', 'meals', 'nutrients'],
    calcium: ['calcium', 'bones', 'dairy', 'milk', 'strong bones', 'osteoporosis'],
    vitamin: ['vitamin', 'supplement', 'deficiency', 'nutrient'],
    weight: ['weight', 'lose weight', 'gain weight', 'obesity', 'healthy weight'],
    
    // Exercise related
    exercise: ['exercise', 'workout', 'physical activity', 'fitness', 'movement'],
    walking: ['walking', 'walk', 'step', 'movement', 'exercise'],
    yoga: ['yoga', 'stretch', 'flexibility', 'balance', 'exercise'],
    swimming: ['swimming', 'water exercise', 'aquatic'],
    strength: ['strength', 'resistance', 'weights', 'muscle', 'training'],
    
    // Health related
    blood: ['blood', 'pressure', 'circulation', 'hypertension'],
    sleep: ['sleep', 'insomnia', 'rest', 'fatigue', 'tired', 'bedroom'],
    heart: ['heart', 'cardiac', 'cardiovascular', 'blood pressure', 'cholesterol'],
    medicine: ['medicine', 'medication', 'pills', 'prescription', 'drug', 'dose'],
    medication: ['medication', 'medicine', 'pills', 'prescription', 'drug', 'dose'],
    
    // Family related — expanded for personal queries
    son: ['son', 'child', 'family', 'robert', 'children', 'immediate family'],
    daughter: ['daughter', 'child', 'family', 'susan', 'children', 'immediate family'],
    family: ['family', 'relatives', 'relationships', 'loved ones', 'grandchildren', 'son', 'daughter', 'children'],
    grandchildren: ['grandchildren', 'grandkids', 'kids', 'family', 'emma', 'lucas', 'sophia', 'oliver', 'isabella'],
    grandchild: ['grandchild', 'grandchildren', 'grandkids', 'family'],
    husband: ['husband', 'spouse', 'partner', 'james', 'married', 'wedding', 'family'],
    wife: ['wife', 'spouse', 'partner', 'married', 'wedding', 'family'],
    pet: ['pet', 'dog', 'cat', 'animal', 'buddy', 'whiskers', 'chester', 'parrot'],
    birthday: ['birthday', 'born', 'date of birth', 'celebration', 'age'],
    age: ['age', 'years old', 'birthday', 'born', 'date of birth'],
    live: ['live', 'stay', 'lives', 'city', 'location', 'address', 'home', 'residence'],
    stay: ['stay', 'live', 'lives', 'city', 'location', 'address', 'home', 'residence'],
    recipe: ['recipe', 'cook', 'bake', 'food', 'pie', 'cookies', 'kitchen'],
    hobby: ['hobby', 'hobbies', 'activity', 'interest', 'enjoys', 'pastime', 'leisure'],
    tradition: ['tradition', 'traditions', 'custom', 'celebrate', 'celebration', 'annual', 'ritual'],
    communication: ['communication', 'talk', 'conversation', 'connect', 'contact'],
    
    // General wellness
    health: ['health', 'wellness', 'healthy', 'medical'],
    elderly: ['elderly', 'senior', 'aging', 'older', 'age'],
    safe: ['safe', 'safety', 'prevent', 'prevent injury', 'precaution'],
  }

  /**
   * Expand query with synonyms
   */
  static expandQuery(query) {
    const lowerQuery = query.toLowerCase()
    const expandedTerms = new Set([query])

    // Find matching synonyms
    Object.keys(this.synonymMap).forEach((key) => {
      if (lowerQuery.includes(key)) {
        this.synonymMap[key].forEach((synonym) => {
          expandedTerms.add(synonym)
        })
      }
    })

    return Array.from(expandedTerms)
  }

  /**
   * Create expanded query string
   */
  static getExpandedQueryString(query) {
    const expandedTerms = this.expandQuery(query)
    return expandedTerms.join(' ')
  }

  /**
   * Extract keywords from query for fallback search
   */
  static extractKeywords(query) {
    const stopWords = ['that', 'this', 'what', 'when', 'where', 'which', 'help', 'tell', 'give', 'does', 'about', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'also', 'just', 'like', 'some', 'they', 'them', 'than', 'then', 'more', 'very', 'much', 'many']
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 2)
      .filter((word) => !stopWords.includes(word))
  }
}

module.exports = QueryExpansionService