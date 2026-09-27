import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge, BadgeCriteriaType } from '@app/common/entities/badge.entity';

@Injectable()
export class BadgesService implements OnModuleInit {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    @InjectRepository(Badge)
    private badgeRepository: Repository<Badge>,
  ) {}

  async onModuleInit() {
    await this.seedEliteBadges();
  }

  async seedEliteBadges() {
    const eliteBadges = [
      { name: 'Verified Mechanic', description: 'Passed all strict KYC and background checks. A trusted provider.', icon: 'verified_user', criteriaType: BadgeCriteriaType.VERIFIED_KYC, criteriaValue: 1 },
      { name: 'Bronze Wrench', description: 'Complete 100 jobs on the platform.', icon: 'bronze_wrench', criteriaType: BadgeCriteriaType.COMPLETED_JOBS, criteriaValue: 100 },
      { name: 'Rising Star', description: 'Receive 100 five-star reviews from customers.', icon: 'star_rising', criteriaType: BadgeCriteriaType.FIVE_STAR_REVIEWS, criteriaValue: 100 },
      { name: '1-Year Veteran', description: 'Active on QuickMechanic for 1 full year.', icon: 'vet_1_year', criteriaType: BadgeCriteriaType.YEARS_ACTIVE, criteriaValue: 1 },
      { name: 'Silver Wrench', description: 'Complete 500 jobs on the platform.', icon: 'silver_wrench', criteriaType: BadgeCriteriaType.COMPLETED_JOBS, criteriaValue: 500 },
      { name: 'Local Hero', description: 'Receive 500 five-star reviews from customers.', icon: 'star_hero', criteriaType: BadgeCriteriaType.FIVE_STAR_REVIEWS, criteriaValue: 500 },
      { name: '3-Year Veteran', description: 'Active on QuickMechanic for 3 full years.', icon: 'vet_3_year', criteriaType: BadgeCriteriaType.YEARS_ACTIVE, criteriaValue: 3 },
      { name: 'Gold Wrench', description: 'Complete 1,000 jobs on the platform.', icon: 'gold_wrench', criteriaType: BadgeCriteriaType.COMPLETED_JOBS, criteriaValue: 1000 },
      { name: 'Titan of the Road', description: 'Complete 1,500 jobs on the platform. A true road warrior.', icon: 'titan_road', criteriaType: BadgeCriteriaType.COMPLETED_JOBS, criteriaValue: 1500 },
      { name: 'The Perfect Legend', description: 'Receive 1,000 five-star reviews. Absolute perfection.', icon: 'star_legend', criteriaType: BadgeCriteriaType.FIVE_STAR_REVIEWS, criteriaValue: 1000 },
      { name: 'The Apex Founder', description: 'Active on QuickMechanic for 5 full years. An elite founder.', icon: 'vet_5_year', criteriaType: BadgeCriteriaType.YEARS_ACTIVE, criteriaValue: 5 },
    ];

    for (const badgeData of eliteBadges) {
      const existing = await this.badgeRepository.findOne({ where: { name: badgeData.name } });
      if (!existing) {
        const newBadge = this.badgeRepository.create(badgeData);
        await this.badgeRepository.save(newBadge);
        this.logger.log(`Seeded Elite Badge: ${badgeData.name} (${badgeData.criteriaValue} ${badgeData.criteriaType})`);
      }
    }
  }
}
